# Una caché por imagen, compartida con la publicación de deploy.yml.
# Sin scope, los targets sobrescriben la misma caché de BuildKit.
target "gateway" {
  cache-from = ["type=gha,timeout=2m,scope=gateway"]
  cache-to   = ["type=gha,mode=max,timeout=2m,ignore-error=true,scope=gateway"]
}

target "web" {
  cache-from = ["type=gha,timeout=2m,scope=web"]
  cache-to   = ["type=gha,mode=max,timeout=2m,ignore-error=true,scope=web"]
}

target "api" {
  cache-from = ["type=gha,timeout=2m,scope=api"]
  cache-to   = ["type=gha,mode=max,timeout=2m,ignore-error=true,scope=api"]
}

target "admin" {
  cache-from = ["type=gha,timeout=2m,scope=admin"]
  cache-to   = ["type=gha,mode=max,timeout=2m,ignore-error=true,scope=admin"]
}

target "search" {
  cache-from = ["type=gha,timeout=2m,scope=search"]
  cache-to   = ["type=gha,mode=max,timeout=2m,ignore-error=true,scope=search"]
}

target "postgres" {
  cache-from = ["type=gha,timeout=2m,scope=postgres"]
  cache-to   = ["type=gha,mode=max,timeout=2m,ignore-error=true,scope=postgres"]
}

target "geocoder-fake" {
  cache-from = ["type=gha,timeout=2m,scope=geocoder-fake"]
  cache-to   = ["type=gha,mode=max,timeout=2m,ignore-error=true,scope=geocoder-fake"]
}
