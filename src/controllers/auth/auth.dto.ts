import { IsEmail, IsNotEmpty, MinLength, ValidateIf } from "class-validator";
import { User } from "src/database/user.entity";

export class LoginDto {

  @ValidateIf(stdId => /^\w{4}\d{5}$/.test(stdId))
  @IsNotEmpty()
  public studentId: string;

  @MinLength(8)
  @IsNotEmpty()
  @ValidateIf(password => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password))
  public password: string;
}

export class LoginResponse {
  constructor(
    public token: string,
    public user: User,
  ) { }
}