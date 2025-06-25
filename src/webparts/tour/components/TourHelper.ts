export class TourHelper {
  public static getTourSteps(settings: any[]): any[] {
    const result: any[] = [];


    if (settings && settings.length > 0) {
      settings.forEach(ele => {
        if (ele.Enabled) {
          const selector = `[data-sp-feature-instance-id='${ele.WebPart}']`;
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
}