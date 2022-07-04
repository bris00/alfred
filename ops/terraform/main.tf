terraform {
  backend "gcs" {
    bucket  = "alfred-tf-state"
    prefix  = "terraform/state"
  }

  required_providers {
    random = {
      source = "hashicorp/random"
      version = "3.3.2"
    }
    google = {
      source  = "hashicorp/google"
      version = "4.26.0"
    }
    sops = {
      source = "carlpett/sops"
      version = "0.7.1"
    }
  }
}

provider "sops" {}

data "sops_file" "alfred-env" {
  source_file = "secrets/alfred-env.enc.json"
}

locals {
  project = "alfred-354216"
  region  = "europe-west1"
  zone    = "europe-west1-b"

  compute_instance_name = "alfred-vm"
  compute_instances = {for k, c in [data.google_compute_instance.data-vm] : k => c if c.id != null}
}

provider "google" {
  project = local.project
  region  = local.region
  zone    = local.zone
}

provider "google-beta" {
  project = local.project
  region  = local.region
  zone    = local.zone
}

resource "random_id" "db_name_suffix" {
  byte_length = 4
}

resource "google_service_account" "service-account" {
  account_id   = "alfred-svc-account"
  display_name = "Alfred Service Account"
}

resource "google_artifact_registry_repository" "repo" {
  provider = google-beta

  repository_id = "alfred"
  format = "DOCKER"

  location  = local.region
}

resource "google_artifact_registry_repository_iam_member" "repo-iam" {
  provider = google-beta

  location = google_artifact_registry_repository.repo.location
  repository = google_artifact_registry_repository.repo.name
  role   = "roles/artifactregistry.reader"
  member = "serviceAccount:${google_service_account.service-account.email}"
}

module "gce-container" {
  source = "terraform-google-modules/container-vm/google"
  version = "3.0.0"

  container = {
    image = "europe-west1-docker.pkg.dev/alfred-354216/alfred/alfred:latest@sha256:9fec377309138413f69a2357c7c0f8de20515cabad3bbbdf54d271b0957475fc"

    env = [
      {
        name = "DISCORD_BOT_TOKEN"
        value = data.sops_file.alfred-env.data["DISCORD_BOT_TOKEN"]
      },
      {
        name = "DATABASE_CONNECTION_URI"
        value = "postgres://${google_sql_user.dbuser.name}:${google_sql_user.dbuser.password}@${google_sql_database_instance.postgres.ip_address.0.ip_address}:5432/${google_sql_database.database.name}"
      },
      {
        name = "ENABLE_CASINO"
        value = "false"
      },
      {
        name = "ENABLE_MONOPOLY"
        value = "true"
      },
    ]
  }

  restart_policy = "Always"
}

resource "google_compute_instance" "vm" {
  project      = local.project
  name         = local.compute_instance_name
  machine_type = "e2-micro"
  zone         = local.zone

  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = module.gce-container.source_image
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata = {
    gce-container-declaration = module.gce-container.metadata_value
    google-logging-enabled    = "true"
    google-monitoring-enabled = "true"
  }

  labels = {
    container-vm = module.gce-container.vm_container_label
  }

  service_account {
    email = google_service_account.service-account.email
    scopes = ["cloud-platform"]
  }
}

data "google_compute_instance" "data-vm" {
  name = local.compute_instance_name
}

resource "google_sql_database_instance" "postgres" {
  name             = "postgres-instance-${random_id.db_name_suffix.hex}"
  database_version = "POSTGRES_14"

  settings {
    tier = "db-f1-micro"

    dynamic "ip_configuration" {
      for_each = length(local.compute_instances) > 0 ? [null] : []

      content {
        dynamic "authorized_networks" {
          for_each = local.compute_instances
          iterator = apps

          content {
            name  = apps.value.name
            value = apps.value.network_interface.0.access_config.0.nat_ip
          }
        }
      }
    }
  }
}

resource "google_sql_database" "database" {
  name     = "alfred"
  instance = google_sql_database_instance.postgres.name
}

resource "random_password" "dbpassword" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "google_sql_user" "dbuser" {
  name     = "alfred"
  instance = google_sql_database_instance.postgres.name
  password = random_password.dbpassword.result
}

resource "null_resource" "gce_null_instance" {
  triggers = {
    config_sha = sha1(jsonencode(module.gce-container))
  }

  provisioner "local-exec" {
    command = "gcloud compute ssh --quiet --project=${local.project} --zone=${local.zone} ${google_compute_instance.vm.name} --command 'sudo systemctl start konlet-startup'"
  }

  depends_on = [
    google_compute_instance.vm
  ]
}