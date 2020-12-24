export interface ContainerConfig {
  name: string;
  url: string;
  env: { [key: string]: string };
}