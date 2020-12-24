export interface ContainerLabels {
  "docker-ci.enable": string,
  "docker-ci.name": string,
  "docker-ci.repo-url": string,
  "docker-ci.email": string;
  "traefik.enable": string,
  "traefik.http.middlewares.redirect.redirectscheme.scheme": string,
}