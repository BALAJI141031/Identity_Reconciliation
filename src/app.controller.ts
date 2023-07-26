import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AppService } from './app.service';
import { CreateContactDto } from './dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('identify')
  @UsePipes(new ValidationPipe({ transform: true }))
  createContact(@Body() createContactDto: CreateContactDto): Promise<any> {
    return this.appService.createContact(createContactDto);
  }
}
