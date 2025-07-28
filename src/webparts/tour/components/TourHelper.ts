import { ElementType } from "office-ui-fabric-react";

export class TourHelper {
  public static getTourSteps(settings: any[]): any[] {
    const result: any[] = [];

    if (settings && settings.length > 0) {
      settings.forEach(ele => {
        let selector: string | undefined;
        let navUrl: string | undefined;

        if (ele.Enabled) {
          if (ele.elementType === 'webpart') {
            if (ele.section !== undefined && ele.column !== undefined) {
              selector = `[data-sp-feature-instance-id='${ele.WebPart}']`;
            } else {
              selector = ele.selector;
            }
          } else if (ele.elementType === 'navigation') {
            const navIdentifier = ele.key.split(':');
            const navType = navIdentifier[0];
            navUrl = navIdentifier[1];
            selector = `a[href="${navUrl}"]`;
          }
          
          // Include all steps up front, even if the DOM element isn't there yet
          result.push({
            id: ele.id,
            selector: selector,
            url: navUrl,
            content: ele.StepDescription,
            position: ele.position || 'auto'
          });
        }
      });
    }

    return result;
  }

}
