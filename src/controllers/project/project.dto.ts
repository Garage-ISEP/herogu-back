import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsHash, IsObject, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from "class-validator";

export class CreateProjectDto {
  @Matches(/^(?!(create|admin|garage|isep|-))([a-z-0-9-]{3,15})[^-]$/)
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
  @IsHash('sha256')
  public rootDirSha: string;

  @IsObject()
  @IsOptional()
  public env: { [key: string]: string } = {};
  
}

export class MysqlLinkDto {

  @IsString()
  @MaxLength(100000)
  @IsOptional()
  public mysql?: string;
}