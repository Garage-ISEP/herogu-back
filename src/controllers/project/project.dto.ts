import { IsArray, IsEnum, IsObject, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class CreateProjectDto {
  @MinLength(5)
  public name: string;

  @IsUrl()
  public githubLink: string;

  @IsEnum(["nginx", "php"])
  public type: "nginx" | "php";
}

export class DockerLinkDto {

  @IsObject()
  public env: { [key: string]: string };
}

export class MysqlLinkDto {

  @IsString()
  @MaxLength(100000)
  @IsOptional()
  public mysql?: string;
}