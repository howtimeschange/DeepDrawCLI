export type ApiRiskLevel = "read" | "caution" | "write" | "paid" | "paid_write";
export type ApiTransport = "http" | "java-sdk";
export type HttpMethod = "GET" | "POST";
export type DeepdrawPath = "/rest" | "/rest/v2";

export interface ApiParameter {
  name: string;
  required: boolean;
  source: "query" | "body";
  description: string;
}

export interface ApiDefinition {
  apiName: string;
  title: string;
  group: "merchant" | "trade" | "product" | "image" | "common";
  version: "v1" | "v2";
  transport: ApiTransport;
  method: HttpMethod;
  path: DeepdrawPath;
  riskLevel: ApiRiskLevel;
  approvalRequired: boolean;
  callSyntax: string;
  semanticCommand: string | null;
  requiredParams: ApiParameter[];
  optionalParams: ApiParameter[];
  notes: string;
}
