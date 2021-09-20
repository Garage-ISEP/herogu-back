import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from "class-validator";

export class CreateProjectDto {
  @MinLength(3)
  @MaxLength(10)
  @Matches(/[a-zA-Z ]*/)
  @Matches(/^((?!create).)*$/)
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