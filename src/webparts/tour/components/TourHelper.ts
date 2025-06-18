export class TourHelper {
  public static getTourSteps(settings: any[]): any[] {
    const result: any[] = [];

    if (settings && settings.length > 0) {
      settings.forEach(ele => {
        if (ele.Enabled) {
          const selector = `[data-sp-feature-instance-id='${ele.WebPart}']`;
          const targetExists = typeof document !== "undefined" && document.querySelector(selector);

          if (targetExists) {
            result.push({
              id: ele.id,
              selector: selector,
              content: ele.StepDescription
            });
          } else {
            console.warn(`Tour step skipped: No DOM element found for selector ${selector}`);
          }
        }
      });
    }

    return result;
  }
}



