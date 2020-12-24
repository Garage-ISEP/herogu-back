export interface ContainerConfig {
  name: string;
  url: string;
  email: string;
  env: { [key: string]: string };
}