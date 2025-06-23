import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  BaseClientSideWebPart
} from '@microsoft/sp-webpart-base';


import * as strings from 'TourWebPartStrings';
import Tour from './components/Tour';
import { ITourProps } from './components/ITourProps';
import { PropertyFieldCollectionData, CustomCollectionFieldType } from '@pnp/spfx-property-controls/lib/PropertyFieldCollectionData';
import { sp, ClientSidePage, ClientSideWebpart, IClientControlEmphasis } from '@pnp/sp';
import { IPropertyPaneConfiguration, IPropertyPaneDropdownOption, PropertyPaneTextField } from '@microsoft/sp-property-pane';

export interface ITourWebPartProps {
  actionValue: string;
  description: string;
  collectionData: any[];
  steps: any[];
}

export default class TourWebPart extends BaseClientSideWebPart<ITourWebPartProps> {

  private loadIndicator: boolean = true;
  private webpartList: any[] = new Array<any[]>();
  private _webPartOptions: IPropertyPaneDropdownOption[] = [];

  public onInit(): Promise<void> {

    return super.onInit().then(_ => {
      sp.setup({
        spfxContext: this.context
      });
    });
  }

  public render(): void {
    const element: React.ReactElement<ITourProps> = React.createElement(
      Tour,
      {
        actionValue: this.properties.actionValue,
        description: this.properties.description,
        collectionData: this.properties.collectionData,
        webPartInstanceId: this.instanceId
      }
    );
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  private highlightWebPart = (instanceId: string): void => {
    const element = document.querySelector(`[data-sp-feature-instance-id='${instanceId}']`);
    if (!element) return;

    element.classList.add("tour-highlight-preview");

    setTimeout(() => {
      element.classList.remove("tour-highlight-preview");
    }, 2000);
  };

  public async GetAllWebpart(): Promise<any[]> {
    const file = sp.web.getFileByServerRelativePath(this.context.pageContext.site.serverRequestPath);
    const page = await ClientSidePage.fromFile(file);

    const wpData: any[] = [];

    page.sections.forEach(section => {
      section.columns.forEach(column => {
        column.controls.forEach(control => {
          let title = "";
          let instanceId = control.data.webPartData?.instanceId ?? control.data.id;
          let labelPrefix = `sec[${section.order}] col[${column.order}]`;

          if (control.data.webPartData) {
            title = control.data.webPartData.title ?? "(untitled)";
          } else {
            title = "Webpart";
          }

          // Attempt to read preview text from rendered DOM
          let previewText = "";
          const domEl = document.querySelector(`[data-sp-feature-instance-id='${instanceId}']`);

          if (domEl) {
            const heading = domEl.querySelector('h1,h2,h3,h4,h5,.ms-webpart-titleText');
            if (heading?.textContent) {
              previewText = heading.textContent.trim();
            } else {
              // fallback: trim and sanitize general content
              const rawText = domEl.textContent?.trim().replace(/\s+/g, " ") ?? "";
              previewText = rawText.substring(0, 60) + (rawText.length > 60 ? "…" : "");
            }
          }

          wpData.push({
            key: instanceId,
            text: `${labelPrefix} - ${title}${previewText ? ` (${previewText})` : ""}`
          });
        });
      });
    });

    return wpData;
  }

  protected onPropertyPaneConfigurationStart(): void {
    var self = this;
    this.GetAllWebpart().then(res => {
      const exists = new Set<string>();
      const uniqueWebParts = res.filter(wp => {
        if (exists.has(wp.key)) return false;
        exists.add(wp.key);
        return true;
      });

      uniqueWebParts.sort((a, b) => a.text.localeCompare(b.text));

      self.webpartList = uniqueWebParts;
      self.loadIndicator = false;
      self.context.propertyPane.refresh();

    });
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
  if (!this.properties.collectionData) {
    this.properties.collectionData = [];
  }

  // Ensure each entry has a unique ID for React key stability
  this.properties.collectionData = this.properties.collectionData.map(item => ({
    id: item.id,
    ...item
  }));

  const webPartOptions = this._webPartOptions ?? [];

  return {
    pages: [
      {
        header: {
          description: strings.PropertyPaneDescription
        },
        groups: [
          {
            groupName: strings.BasicGroupName,
            groupFields: [
              PropertyPaneTextField('actionValue', {
                label: strings.ActionValueFieldLabel
              }),
              PropertyPaneTextField('description', {
                label: strings.DescriptionFieldLabel
              }),
              PropertyFieldCollectionData("collectionData", {
                key: "collectionData",
                label: "Tour steps",
                panelHeader: "Collection data panel header",
                manageBtnLabel: "Configure tour steps",
                value: this.properties.collectionData,
                fields: [
                  {
                    id: "WebPart",
                    title: "section[x] column[y] - WebPart Title",
                    type: CustomCollectionFieldType.custom,
                    onCustomRender: (field, value, onUpdate, item, itemId) => {
                      return React.createElement("select", {
                        value: value,
                        onChange: (e) => onUpdate(field.id, e.currentTarget.value),
                        onMouseOver: (e) => {
                          const instanceId = (e.target as HTMLSelectElement).value;
                          this.highlightWebPart(instanceId);
                        },
                        style: {width: "300px"}
                      },
                    this.)
                    }
                    options: this.webpartList,
                    required: true,
                  },
                  {
                    id: "StepDescription",
                    title: "Step Description",
                    type: CustomCollectionFieldType.custom,
                    onCustomRender: (field, value, onUpdate, item, itemId) => {
                      return (
                        React.createElement("div", null,
                          React.createElement("textarea",
                            {
                              style: { width: "100%", height: "60px" },
                              placeholder: "Step description",
                              key: itemId,
                              value: value,
                              onChange: (event: React.FormEvent<HTMLTextAreaElement>) => {
                                onUpdate(field.id, event.currentTarget.value);
                              }
                            })
                        )
                      );
                    }
                  },
                  {
                    id: "Position",
                    title: "Position",
                    type: CustomCollectionFieldType.number,
                    required: true
                  },
                  {
                    id: "Enabled",
                    title: "Enabled",
                    type: CustomCollectionFieldType.boolean,
                    defaultValue: true
                  }
                ],
                disabled: false
              })
            ]
          }
        ]
      }
    ],
    loadingIndicatorDelayTime: 5,
    showLoadingIndicator: this.loadIndicator
  };
}
}
