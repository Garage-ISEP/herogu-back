import { IsEmail, IsUrl, MinLength, ValidateIf } from 'class-validator';

export class CreateProjectRequest {

  @MinLength(5)
  name: string;

  @IsUrl()
  docker_img_link: string;

}