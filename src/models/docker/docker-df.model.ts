export namespace DockerDf {
  export interface Labels {
    ORIGIN: string;
    maintainer: string;
    ["herogu.sha"]?: string;
    ["org.label - schema.description"]: string;
    ["org.label - schema.license"]: string;
    ["org.label - schema.name"]: string;
    ["org.label - schema.vendor"]: string;
    ["org.label - schema.version"]: string;
    ["org.opencontainers.image.source"]: string;
    [key: string]: string;
  }
  export interface Image {
    Containers: number;
    Created: number;
    Id: string;
    Labels: Labels;
    ParentId: string;
    RepoDigests: string[];
    RepoTags: string[];
    SharedSize: number;
    Size: number;
    VirtualSize: number;
  }

  export interface Port {
    IP: string;
    PrivatePort: number;
    PublicPort: number;
    Type: string;
  }

  export interface HostConfig {
    NetworkMode: string;
  }

  export interface Web {
    IPAMConfig?: any;
    Links?: any;
    Aliases?: any;
    NetworkID: string;
    EndpointID: string;
    Gateway: string;
    IPAddress: string;
    IPPrefixLen: number;
    IPv6Gateway: string;
    GlobalIPv6Address: string;
    GlobalIPv6PrefixLen: number;
    MacAddress: string;
    DriverOpts?: any;
  }

  export interface Bridge {
    IPAMConfig?: any;
    Links?: any;
    Aliases?: any;
    NetworkID: string;
    EndpointID: string;
    Gateway: string;
    IPAddress: string;
    IPPrefixLen: number;
    IPv6Gateway: string;
    GlobalIPv6Address: string;
    GlobalIPv6PrefixLen: number;
    MacAddress: string;
    DriverOpts?: any;
  }

  export interface Networks {
    web: Web;
    bridge: Bridge;
  }

  export interface NetworkSettings {
    Networks: Networks;
  }

  export interface Mount {
    Type: string;
    Name: string;
    Source: string;
    Destination: string;
    Driver: string;
    Mode: string;
    RW: boolean;
    Propagation: string;
  }

  export interface Container {
    Id: string;
    Names: string[];
    Image: string;
    ImageID: string;
    Command: string;
    Created: number;
    Ports: Port[];
    SizeRw: number;
    SizeRootFs: number;
    Labels: Labels;
    State: string;
    Status: string;
    HostConfig: HostConfig;
    NetworkSettings: NetworkSettings;
    Mounts: Mount[];
  }

  export interface UsageData {
    RefCount: number;
    Size: number;
  }

  export interface Volume {
    CreatedAt: Date;
    Driver: string;
    Labels?: any;
    Mountpoint: string;
    Name: string;
    Options?: any;
    Scope: string;
    UsageData: UsageData;
  }

  export interface BuildCache {
    ID: string;
    Parent: string;
    Type: string;
    Description: string;
    InUse: boolean;
    Shared: boolean;
    Size: number;
    CreatedAt: Date;
    LastUsedAt?: Date;
    UsageCount: number;
  }

  export interface DockerDf {
    LayersSize: number;
    Images: Image[];
    Containers: Container[];
    Volumes: Volume[];
    BuildCache: BuildCache[];
    BuilderSize: number;
  }
}