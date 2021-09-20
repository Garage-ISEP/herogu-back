import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from "class-validator";

export class CreateProjectDto {
  @Matches(/^(?!(create|admin|garage|isep))\w{3,10}$/)
  public name: string;

  @IsUrl()
  public githubLink: string;

  @IsEnum(["nginx", "php"])
  public type: "nginx" | "php";

  @IsBoolean()
  public mysqlEnabled = false;
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