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
        const primaryContact = exisitingContactWithEmail.filter(
          (contact) => contact.linkPrecedence == LinkPrecedence.primary,
        );
        const secondaryContacts = await this.contactRepository.getContacts({
          linkedId: primaryContact[0].id,
        });
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
          linkPrecedence: LinkPrecedence.primary,
        });
      if (existingContactWithSameDetails) {
        // fetch links
        const secondaryContacts = await this.contactRepository.getContacts({
          linkedId: existingContactWithSameDetails.id,
        });
        const emails = secondaryContacts?.map((contact) => contact.email);
        const phoneNumbers = secondaryContacts?.map(
          (contact) => contact.phoneNumber,
        );
        const ids = secondaryContacts?.map((contact) => contact.id);
        return {
          contact: {
            primaryContatctId: existingContactWithSameDetails.id,
            emails: [existingContactWithSameDetails.email, ...emails],
            phoneNumbers: [
              existingContactWithSameDetails.phoneNumber,
              ...phoneNumbers,
            ],
            secondaryContactIds: [...ids],
          },
        };
      } else {
        const existingSecondaryContactWithSameDetails =
          await this.contactRepository.getContactByEmailAndPhone({
            email,
            phoneNumber,
            linkPrecedence: LinkPrecedence.secondary,
          });
        if (existingSecondaryContactWithSameDetails) {
          // fetch links
          const primaryContact = await this.contactRepository.getPrimaryContact(
            {
              id: existingSecondaryContactWithSameDetails.linkedId,
            },
          );
          const secondaryContacts = await this.contactRepository.getContacts({
            linkedId: primaryContact.id,
          });
          const emails = secondaryContacts?.map((contact) => contact.email);
          const phoneNumbers = secondaryContacts?.map(
            (contact) => contact.phoneNumber,
          );
          const ids = secondaryContacts?.map((contact) => contact.id);
          return {
            contact: {
              primaryContatctId: primaryContact.id,
              emails: [primaryContact.email, ...emails],
              phoneNumbers: [primaryContact.phoneNumber, ...phoneNumbers],
              secondaryContactIds: [...ids],
            },
          };
        }
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
        const contact = await this.contactRepository.createContact({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.primary,
        });
        return {
          contact: {
            primaryContatctId: contact.id,
            emails: [contact.email],
            phoneNumbers: [contact.phoneNumber],
            secondaryContactIds: [],
          },
        };
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