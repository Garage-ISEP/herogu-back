import { IsEmail, IsNotEmpty, IsOptional, MinLength, ValidateIf } from "class-validator";
import { User } from "src/database/user/user.entity";

export class LoginDto {

  @ValidateIf(stdId => /^\w{4}\d{5}$/.test(stdId))
  @IsNotEmpty()
  public studentId: string;

  @MinLength(8)
  @IsNotEmpty()
  public password: string;

  @IsOptional()
  public admin = false;
}

export class LoginResponse {
  constructor(
    public token: string,
    public user: User,
  ) { }
}