import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsHash, IsObject, IsOptional, IsString, IsUrl, Matches } from "class-validator";

export class CreateProjectDto {
  @Matches(/^(?!(create|admin|garage|isep|herogu|auth|phpmyadmin|portainer|traefik|data|post|get|put|dashboard|dash|board|-))([a-z-0-9-]{3,15})(?<!-)$/)
  public name: string;

  @IsUrl()
  public githubLink: string;

  @IsEnum(["nginx", "php"])
  public type: "nginx" | "php";

  @IsBoolean()
  public mysqlEnabled = false;

  @IsBoolean()
  public notificationsEnabled = false;

  @IsArray()
  @ArrayMaxSize(10)
  public addedUsers: string[];

  @IsString()
  public rootDir: string;

  @IsOptional()
  @IsHash('sha1')
  public rootDirSha: string;

  @IsObject()
  @IsOptional()
  public env: { [key: string]: string } = {};
  
}