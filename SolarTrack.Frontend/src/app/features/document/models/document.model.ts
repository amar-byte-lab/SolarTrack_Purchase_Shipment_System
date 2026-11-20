export interface ModuleSerialItem {
  index: number;
  serialNo: string;
  capacity: number;
}

export interface TechnicalProductSpecs {
  // 1. General & Milestones
  dateOfInstallation?: string;
  dateOfCommission?: string;
  connectionType?: string;
  state?: string;
  district?: string;
  pinCode?: string;
  address?: string;

  // 2. Inverter
  inverterMake?: string;
  inverterName?: string;
  inverterSerialNo?: string;
  inverterCapacity?: number;
  inverterInputVoltage?: number;
  inverterOutputVoltage?: string;
  inverterCount?: number;

  // 3. PV Module
  moduleMake?: string;
  moduleCount?: number;
  moduleTypeModel?: string;
  moduleCapacityEach?: number;
  moduleTotalCapacity?: string;
  moduleSerials?: ModuleSerialItem[];

  // 4. DCDB & ACDB
  dcdbMake?: string;
  dcdbMcbDetails?: number;
  dcdbSerialNo?: string;
  dcdbSpdRating?: string;
  acdbMake?: string;
  acdbMcbDetails?: number;
  acdbSerialNo?: string;
  acdbSpdRating?: string;

  // 5. Cables & Earthing
  dcCableMake?: string;
  earthResistance?: number;
  dcEarthing?: number;
  acEarthing?: number;
  earthWireSize?: number;
  laSizeType?: string;
  dcCableSizeType?: number;
}

export type DocumentType = 'agreement' | 'form1' | 'form3' | 'form4' | 'form6';

export interface Form1Data {
  discomOffice: string;
  displayDate: string;
  applicantName: string;
  address: string;
  consumerNo: string;
  mobile: string;
  email: string;
  reTypeCapacity: string;
  sanctionLoad: string;
  meterProcChoice: 'Beneficiary' | 'DISCOM';
  location: string;
  inverterMakeType: string;
  inverterAutoIso: string;
  existingPlants: string;
  existingCapacity: string;
  commissionDays: string;
  category: string;
  voltageLevel: string;
  declarationText: string;
  signApplicant: string;
}
