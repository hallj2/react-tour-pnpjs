declare interface ITourWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  DescriptionFieldLabel: string;
  ActionValueFieldLabel: string;
  PropertyPaneActionValue: string;
  DataAutomationIdLabel: string;
  SiteMenuClassLabel: string;
}

declare module 'TourWebPartStrings' {
  const strings: ITourWebPartStrings;
  export = strings;
}
