export class CvTitleSignalMissingError extends Error {
  constructor() {
    super(
      "Couldn't find a target role in this CV. State a clearer job title or list relevant skills/technologies.",
    );
    this.name = "CvTitleSignalMissingError";
  }
}
