docker_compose(encode_yaml({
    'services': {
        'alfred': {
            'image': 'localhost/alfred-svc',
            'entrypoint': 'npm start',
            'env_file': 'test.local.env',
            'environment': {
                'DATABASE_CONNECTION_URI': 'sqlite::memory:',
                'ENABLE_MONOPOLY': 'true',
                'ENABLE_CASINO': 'true',
            },
        },
    },
}))

docker_build('localhost/alfred-svc', '.',
    dockerfile='ops/docker/Dockerfile',
    build_args={
        'NODE_ENV': 'development',
        'INSTALL_EXTRA_ARGS': '',
        'RUNTIME_BASE_IMAGE': 'node',
    },
    live_update=[
        sync('.', '/opt/alfred'),
        run('npm install', trigger=['./package.json', './package-lock.json']),
    ]
)

def test(script, deps="."):
    local_resource(script, "npm run %s" % script, deps=deps, allow_parallel=True, labels=["tests"])

test("test:lint")
test("test:unit")
test("test:types")
