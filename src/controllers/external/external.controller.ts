import { Controller, Post, Query } from '@nestjs/common';
import { CiService } from 'src/services/ci.service';

@Controller('external')
export class ExternalController {

  constructor(private readonly _ci: CiService) { }
  @Post('/update-project')
  public async updateProjectContainer(@Query("name") name: string) {
    await this._ci.triggerBuild(name);
  }

}
