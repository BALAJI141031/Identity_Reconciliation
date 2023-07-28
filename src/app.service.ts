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
  private buildResponse(primaryContact: any, secondaryContacts?: any[]): any {
    const emails = secondaryContacts?.map((contact) => contact.email) || [];
    const phoneNumbers =
      secondaryContacts?.map((contact) => contact.phoneNumber) || [];
    const ids = secondaryContacts?.map((contact) => contact.id) || [];

    return {
      contact: {
        primaryContatctId: primaryContact.id,
        emails: [primaryContact.email, ...emails],
        phoneNumbers: [primaryContact.phoneNumber, ...phoneNumbers],
        secondaryContactIds: [...ids],
      },
    };
  }

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
          return this.buildResponse(contact);
        }
        const primaryContact = exisitingContactWithEmail.filter(
          (contact) => contact.linkPrecedence == LinkPrecedence.primary,
        );
        if (primaryContact.length) {
          const secondaryContacts = await this.contactRepository.getContacts({
            linkedId: primaryContact[0].id,
          });
          return this.buildResponse(primaryContact[0], secondaryContacts);
        } else {
          const linkId = exisitingContactWithEmail[0].linkedId;
          const primaryContact = await this.contactRepository.getPrimaryContact(
            {
              id: linkId,
            },
          );
          return this.buildResponse(primaryContact, exisitingContactWithEmail);
        }
      }

      if (!email && phoneNumber) {
        const exisitingContactWithPhone =
          await this.contactRepository.getContactByEmailOrPhone(phoneNumber);
        if (exisitingContactWithPhone.length == 0) {
          const contact = await this.contactRepository.createContact({
            phoneNumber,
            linkPrecedence: LinkPrecedence.primary,
          });
          return this.buildResponse(contact);
        }
        const primaryContact = exisitingContactWithPhone.filter(
          (contact) => contact.linkPrecedence == LinkPrecedence.primary,
        );
        const secondaryContacts = await this.contactRepository.getContacts({
          linkedId: primaryContact[0].id,
        });
        return this.buildResponse(primaryContact[0], secondaryContacts);
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
        return this.buildResponse(
          existingContactWithSameDetails,
          secondaryContacts,
        );
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
          return this.buildResponse(primaryContact, secondaryContacts);
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
        return this.buildResponse(contact);
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
        await this.contactRepository.createContact({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: primaryAccount.id,
        });
        const secondaryContacts = await this.contactRepository.getContacts({
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: primaryAccount.id,
        });
        return this.buildResponse(primaryAccount, secondaryContacts);
      }
      // create secondary contact with new email
      if (
        !exisitingContactWithEmail.length &&
        exisitingContactWithPhone.length
      ) {
        const isPrimaryContact = exisitingContactWithPhone.filter(
          (contact) => contact.linkPrecedence == LinkPrecedence.primary,
        );
        if (!isPrimaryContact.length) {
          const primaryAccount = await this.contactRepository.getPrimaryContact(
            {
              linkPrecedence: LinkPrecedence.primary,
              id: exisitingContactWithPhone[0].linkedId,
            },
          );
          await this.contactRepository.createContact({
            email,
            phoneNumber,
            linkPrecedence: LinkPrecedence.secondary,
            linkedId: primaryAccount.id,
          });
          const secondaryContacts = await this.contactRepository.getContacts({
            linkPrecedence: LinkPrecedence.secondary,
            linkedId: primaryAccount.id,
          });
          return this.buildResponse(primaryAccount, secondaryContacts);
        }
        await this.contactRepository.createContact({
          email,
          phoneNumber,
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: isPrimaryContact[0].id,
        });
        const secondaryContacts = await this.contactRepository.getContacts({
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: isPrimaryContact[0].id,
        });
        return this.buildResponse(isPrimaryContact[0], secondaryContacts);
      }

      const PrimaryContactOfEmail = exisitingContactWithEmail.filter(
        (contact) => contact.linkPrecedence == LinkPrecedence.primary,
      );
      let secondary = [];
      if (PrimaryContactOfEmail.length) {
        const contacts = await this.contactRepository.getContacts({
          linkedId: PrimaryContactOfEmail[0].id,
        });
        secondary = [...contacts];
      } else {
        const contacts = await this.contactRepository.getContacts({
          linkedId: exisitingContactWithEmail[0].linkedId,
        });
        // what happens here more than 2 primary
        const primaryContact = await this.contactRepository.getPrimaryContact({
          linkPrecedence: LinkPrecedence.primary,
          id: exisitingContactWithEmail[0].linkedId,
        });
        secondary = [...contacts, primaryContact];
      }

      const primaryContactOfPhone = exisitingContactWithPhone.filter(
        (contact) => contact.linkPrecedence == LinkPrecedence.primary,
      );

      if (primaryContactOfPhone.length) {
        const contacts = await this.contactRepository.getContacts({
          linkedId: primaryContactOfPhone[0].id,
        });
        secondary = [...secondary, ...contacts];
      } else {
        const contacts = await this.contactRepository.getContacts({
          linkedId: exisitingContactWithPhone[0].linkedId,
        });
        const primaryContact = await this.contactRepository.getPrimaryContact({
          linkPrecedence: LinkPrecedence.primary,
          id: exisitingContactWithPhone[0].linkedId,
        });
        secondary = [...secondary, ...contacts, primaryContact];
      }

      const uniqueArray = [
        ...exisitingContactWithEmail,
        ...exisitingContactWithPhone,
        ...secondary,
      ]
        .reduce((accumulator, currentValue) => {
          if (!accumulator.some((obj) => obj.id === currentValue.id)) {
            accumulator.push(currentValue);
          }
          return accumulator;
        }, [])
        .sort((a, b) => a.id - b.id);

      let ids = [];
      let phoneNumbers = [];
      let emailCombination = [];
      const updatedCombinationContacts = await Promise.all(
        uniqueArray.map(async (contact, i) => {
          if (i !== 0) {
            ids.push(contact.id);
            phoneNumbers.push(contact.phoneNumber);
            emailCombination.push(contact.email);
            contact.linkPrecedence = LinkPrecedence.secondary;
            contact.linkedId = uniqueArray[0].id;
            await this.contactRepository.update(
              { id: contact.id },
              {
                linkPrecedence: LinkPrecedence.secondary,
                linkedId: uniqueArray[0].id,
              },
            );
            return contact;
          }
          return contact;
        }),
      );
      const updatedCombinationContactsClone = [...updatedCombinationContacts];
      updatedCombinationContactsClone.shift();
      return this.buildResponse(
        updatedCombinationContacts[0],
        updatedCombinationContactsClone,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `Server Error, error is ${error?.message}`,
      );
    }
  }
}
