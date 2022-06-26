terraform {
  backend "gcs" {
    bucket  = "alfred-tf-state"
    prefix  = "terraform/state"
  }

  required_providers {
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
    image = "europe-west1-docker.pkg.dev/alfred-354216/alfred/alfred:latest"

    env = [
      {
        name = "DISCORD_BOT_TOKEN"
        value = data.sops_file.alfred-env.data["DISCORD_BOT_TOKEN"]
      },
    ]
  }

  restart_policy = "Always"
}

resource "google_compute_instance" "vm" {
  project      = local.project
  name         = "alfred-vm"
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