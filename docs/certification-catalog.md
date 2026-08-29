# DMZ Scuba Certification Catalog

The customer account uses an agency-neutral certification catalog so equivalent training can be found reliably across different agencies. The original agency and card number remain attached to each credential, while `agencyCode` and `certificationCode` provide stable values for website, mobile, booking, and future service workflows.

For example, SDI Computer Nitrox, PADI Enriched Air Diver, and other equivalent recreational nitrox credentials are stored under `certificationCode: "nitrox"`. A future nitrox-fill workflow can query that code without guessing from free-form card names.

## Catalog scope

The catalog covers the major recreational, technical, public-safety, cave, rebreather, support, and professional pathways used internationally. It is intentionally normalized rather than being a verbatim copy of every agency's branded course catalog. Agency offerings change, distinctive specialties can be created, and regional organizations may use additional names, so both agency and certification lists include an **Other / Not Listed** path without sacrificing the normalized database fields.

The catalog was reviewed against official training paths and standards from:

- [PADI continuing education and professional paths](https://www.padi.com/education/continue-learning)
- [SSI advanced and Extended Range training](https://www.divessi.com/en/advanced-training/scuba-diving)
- [SDI/TDI recreational and technical programs](https://portal.tdisdi.com/elearning-courses?agency=tdi)
- [NAUI training and professional pathways](https://www.naui.org/learn/)
- [IANTD recreational, cave, rebreather, and trimix scope](https://iantd.com/index.php/about-iantd/about-us)
- [BSAC diver, technical, and instructor courses](https://www.bsac.com/training/view-all-bsac-courses/)
- [CMAS international training standards](https://www.cmas.org/?Itemid=692)
- [GUE training standards](https://www.gue.com/files/Standards_and_Procedures/GUE-Standards-v10.1.pdf)

## Data rules

- `agencyCode` identifies the issuing organization.
- `certificationCode` identifies the generalized training outcome.
- `category` groups recreational, specialty, technical, professional, public-safety, and support credentials.
- `doesNotExpire` distinguishes a non-expiring card from a missing expiration date.
- `isProfessional` enables professional standing, insurance, facility, and certifying-instructor fields.
- `verificationStatus` remains separate from self-reported professional standing. DMZ Scuba verification should never be inferred solely from customer-entered data.

The public `GET /api/account/certification-catalog` endpoint is the shared source for website and mobile selectors. Update the catalog version whenever codes or mappings change. Never rename an existing code after records use it; add an alias or a migration instead.
