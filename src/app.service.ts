import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateContactDto } from './dto';

@Injectable()
export class AppService {
  async createContact(createContactDto: CreateContactDto): Promise<string> {
    const { email, phoneNumber } = createContactDto;
    if (!email && !phoneNumber) {
      throw new BadRequestException(
        'Email Or PhoneNUmber is Require To Create Contact',
      );
    }
    return 'Hello World!';
  }
}
