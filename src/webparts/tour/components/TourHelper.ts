export class TourHelper {
  public static getTourSteps(settings: any[]): any[] {
    const result: any[] = [];

    if (settings && settings.length > 0) {
      settings.forEach(ele => {
        if (ele.Enabled) {
          let selector;
          if (ele.section !== undefined && ele.column !== undefined) {
            selector = `[data-sp-feature-instance-id='${ele.WebPart}']`;
          } else {
            selector = ele.selector;
          }
          
          // Include all steps up front, even if the DOM element isn't there yet
          result.push({
            id: ele.id,
            selector: selector,
            content: ele.StepDescription
          });
        }
      });
    }

    return result;
  }

  /* public static getStaticSiteHeaderTourSteps(): any[] {
    const staticSteps = [
      {
        // Target the 'Home' link
        element: 'span.ms-HorizontalNavItem[data-automationid="HorizontalNav-link"] a.ms-HorizontalNavItem-link:contains("Home")',
        intro: 'Click here to go back to the home page.',
        position: 'bottom',
        title: 'Home Link',
      },
      {
        // Target the 'All Documents' link
        element: 'span.ms-HorizontalNavItem[data-automationid="HorizontalNav-link"] a.ms-HorizontalNavItem-link:contains("All Documents")',
        intro: 'This link takes you to the document library where you can access all the documents on this site.',
        position: 'bottom',
        title: 'All Documents Link',
      },
      {
        // Target the 'Forms' link
        element: 'span.ms-HorizontalNavItem[data-automationid="HorizontalNav-link"] a.ms-HorizontalNavItem-link:contains("Forms")',
        intro: 'Find various forms related to your tasks and processes here.',
        position: 'bottom',
        title: 'Forms Link',
      },
      {
        // Target the 'Policies' link
        element: 'span.ms-HorizontalNavItem[data-automationid="HorizontalNav-link"] a.ms-HorizontalNavItem-link:contains("Policies")',
        intro: 'Access the company policies and guidelines through this link.',
        position: 'bottom',
        title: 'Policies Link',
      },
      // Add more static steps for other header items as needed
    ];

    return staticSteps;
  } */


}