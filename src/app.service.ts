import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateContactDto } from './dto';
import { ContactDao } from './app.repository';
import { PrismaClient, Contact, LinkPrecedence } from '@prisma/client';
@Injectable()
export class AppService {
  @Inject(ContactDao)
  private contactRepository: ContactDao;
  async createContact(createContactDto: CreateContactDto): Promise<any> {
    try {
      const { email, phoneNumber } = createContactDto;
      if (!email && !phoneNumber) {
        throw new BadRequestException(
          'Email Or PhoneNUmber is Require To Create Contact',
        );
      }

      if (email && !phoneNumber) {
        const exisitingContactWithEmail =
          await this.contactRepository.getContactByEmailOrPhone(email);
        if (exisitingContactWithEmail.length == 0) {
          const contact = await this.contactRepository.createContact({
            email,
            linkPrecedence: LinkPrecedence.primary,
          });
          return contact;
        }
        //Todo fetch linked id's as well
        return exisitingContactWithEmail;
      }

      if (!email && phoneNumber) {
        const exisitingContactWithPhone =
          await this.contactRepository.getContactByEmailOrPhone(phoneNumber);
        if (exisitingContactWithPhone.length == 0) {
          const contact = await this.contactRepository.createContact({
            phoneNumber,
            linkPrecedence: LinkPrecedence.primary,
          });
          return contact;
        }
        return exisitingContactWithPhone;
      }

      const existingContactWithSameDetails =
        await this.contactRepository.getContactByEmailAndPhone({
          email,
          phoneNumber,
        });
      if (existingContactWithSameDetails) {
        return existingContactWithSameDetails;
      }
      // so email & phone combination is not there

      // checking for email Combination
      const exisitingContactWithEmail =
        await this.contactRepository.getContactByEmailOrPhone(email);
      const exisitingContactWithPhone =
        await this.contactRepository.getContactByEmailOrPhone(phoneNumber);
      if (
        !exisitingContactWithEmail.length &&
        !exisitingContactWithPhone.length
      ) {
        // first contact(primary)
        const contact = await this.contactRepository.createContact({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.primary,
        });
      }

      // create secondary contact with new mobile
      if (
        exisitingContactWithEmail.length &&
        !exisitingContactWithPhone.length
      ) {
        // get primary contact for linking purpose
        const primaryAccount = await this.contactRepository.getPrimaryContact({
          linkPrecedence: LinkPrecedence.primary,
          email,
        });
        const contact = await this.contactRepository.createContact({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: primaryAccount.id,
        });
        return contact;
      }
      // create secondary contact with new email
      if (
        !exisitingContactWithEmail.length &&
        exisitingContactWithPhone.length
      ) {
        const primaryAccount = await this.contactRepository.getPrimaryContact({
          linkPrecedence: LinkPrecedence.primary,
          phoneNumber,
        });
        const contact = await this.contactRepository.createContact({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: primaryAccount.id,
        });
      }

      const combinationContacts = [
        ...exisitingContactWithEmail,
        ...exisitingContactWithPhone,
      ].sort((a, b) => a.id - b.id);

      const updatedCombinationContacts = combinationContacts.map(
        (contact, i) => {
          if (i !== 0) {
            contact.linkPrecedence = LinkPrecedence.secondary;
            contact.linkedId = combinationContacts[0].id;
          }
          return contact;
        },
      );

      // updated db to mark secondary to primary
    } catch (error) {
      throw new InternalServerErrorException(
        `Server Error, error is ${error?.message}`,
      );
    }
  }
}
