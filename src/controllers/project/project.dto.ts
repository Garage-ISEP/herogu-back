import { IsUrl, MinLength } from "class-validator";

export class CreateProjectDto {
  @MinLength(5)
  public name: string;

  @IsUrl()
  public docker_img_link: string;
}