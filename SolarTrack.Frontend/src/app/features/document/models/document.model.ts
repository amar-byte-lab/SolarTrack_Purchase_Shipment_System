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
  inverterModelNo?: string;
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
  dcCableSizeType?: number;
  acCableMake?: string;
  acCableSizeType?: number;
  earthResistance?: number;
  dcEarthing?: number;
  acEarthing?: number;
  earthWireSize?: number;
  laSizeType?: string;
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

export interface Form3Data {
  discomFullName?: string;
  discomShort?: string;
  discomOffice: string;
  capacityKwp: string;
  inspectionLocation: string;
  headerSummary: string;

  // A. Applicant Details
  applicantName: string;
  applicationNoWithDate: string;
  address: string;
  consumerNo: string;
  consumerCategory: string;
  connectionType: string;
  contractDemand: string;
  arrear: string;
  vendorName: string;
  installationDate: string;

  // B. Distribution Transformer Details
  transformerCapacity: string;
  transformerLocation: string;
  transformerTotalRtsCapacity: string;
  transformerCapacityAdequate: string;

  // C. Solar Rooftop PV Power Plant Details
  proposedPlantDetails: string;
  sldOkStatus: string;

  // D. Grid Tied Inverter
  inverterMake: string;
  inverterSerialNo: string;
  inverterCapacity: string;
  inverterVoltages: string;
  inverterAntiIslanding: string;

  // E. P.V Module
  moduleMake: string;
  moduleSerials: string;
  moduleType: string;
  moduleCapacityEach: string;
  moduleCount: string;
  moduleTotalCapacity: string;

  // F. Earthing Verification
  dcEarthing: string;
  acEarthing: string;
  earthingPermissibleText: string;

  // G. Details of protective system available
  protectiveSystemDetails: string;

  // H - L
  protectionBackFeeding: string;
  eicInspectionLetter: string;
  safetyCertificate: string;
  actualSldDiagram: string;
  testReportComponents: string;

  // M. Meter Details
  netMeterTotal: string;
  netMeterMake: string;
  netMeterSerial: string;
  netMeterPhase: string;
  netMeterCapacity: string;
  netMeterConstant: string;

  solarMeterTotal: string;
  solarMeterMake: string;
  solarMeterSerial: string;
  solarMeterPhase: string;
  solarMeterCapacity: string;
  solarMeterConstant: string;

  // N & Inspection Report
  otherRemarks: string;
  satisfactorySyncStatus: string;
  provisionSwitches: string;
  omInfoStatus: string;

  // Signatures
  applicantSignName: string;
  applicantSignDate: string;
  installerFirmName: string;
  installerAddress: string;
  installerSignDate: string;
  certifiedOfficerTitle: string;
  certifiedOfficerDate: string;
}

export interface Form4Data {
  discomShort?: string;
  officerDesignation: string;
  officerAddress: string;
  refPmsgy: string;

  // A. Details of the Application:
  appFgNoDate: string;
  appFees: string;

  // B. Details of the Solar PV Module:
  moduleModelNo: string;
  moduleTotalCapacity: string;
  moduleMake: string;
  moduleSerials: string;
  moduleCount: string;
  moduleCapacityEach: string;
  moduleInstallDate: string;
  moduleCommissionDate: string;

  // C. Details of the Inverter:
  inverterCount: string;
  inverterType: string;
  inverterMake: string;
  inverterModelNo: string;
  inverterCapacity: string;
  inverterSerialNo: string;
  inverterInputVolt: string;
  inverterOutputVolt: string;
  inverterInstallDate: string;
  inverterCommissionDate: string;

  // D. Details of Cables: DC
  dcCableMake: string;
  dcCableSize: string;

  // E. Details of AC Wiring:
  acCableMake: string;
  acCableSize: string;

  // F. Details of the DC distribution box:
  dcdbMake: string;
  dcdbSerialNo: string;
  dcdbSpdRating: string;
  dcdbMcbDetails: string;

  // G. Details of AC distribution box:
  acdbMake: string;
  acdbSerialNo: string;
  acdbSpdRating: string;
  acdbMcbDetails: string;

  // H. Details of Earthing:
  earthResistance: string;
  earthWireSize: string;
  twoEarthingPoints: string;
  lighteningArrester: string;
  laSizeType: string;
  earthingNote: string;

  // I. Net Meter details
  netMeterCount: string;
  netMeterMake: string;
  netMeterSerial: string;
  netMeterCapacity: string;
  netMeterModel: string;
  netMeterPhase: string;
  netMeterCtPtRatio: string;
  netMeterTestDate: string;

  // I (cont.) Solar Meter details
  solarMeterCount: string;
  solarMeterMake: string;
  solarMeterSerial: string;
  solarMeterCapacity: string;
  solarMeterModel: string;
  solarMeterPhase: string;
  solarMeterCtPtRatio: string;
  solarMeterTestDate: string;

  // J. Details of Caution signs
  cautionPanels: string;
  cautionInverters: string;
  cautionDcAcdb: string;

  // K & L
  provisionSwitches: string;
  omInfoStatus: string;
  complianceCert: string;

  // Signatures
  applicantName: string;
  applicantAddress: string;
  applicantDate: string;

  installerFirm: string;
  installerAddress: string;
  installerDate: string;

  officerTitle: string;
  officerDate: string;
}

export interface Form6Data {
  discomName: string;
  capacityKwp: string;
  certText: string;
  headerSummary: string;

  // A. Applicant Details
  applicantName: string;
  applicationNoWithDate: string;
  address: string;
  consumerNo: string;
  consumerCategory: string;
  connectionType: string;
  contractDemand: string;
  arrear: string;

  // B. Distribution Transformer Details
  transformerCapacity: string;
  transformerLocation: string;
  transformerTotalRtsCapacity: string;
  transformerCapacityAdequate: string;

  // C. Solar Rooftop PV Power Plant Details
  proposedPlantDetails: string;
  sldOkStatus: string;

  // D. Grid Tied Inverter
  inverterMake: string;
  inverterSerialNo: string;
  inverterCapacity: string;
  inverterVoltages: string;
  inverterAntiIslanding: string;
  inverterInstallDate: string;

  // E. P.V Module
  moduleMake: string;
  moduleSerials: string;
  moduleTypeModel: string;
  moduleCapacityEach: string;
  moduleCount: string;
  moduleTotalCapacity: string;
  moduleInstallDate: string;

  // F. Earthing Verification
  dcEarthing: string;
  acEarthing: string;
  earthingPermissibleText: string;

  // G. Details of protective system available
  protectiveSystemDetails: string;
  protectiveSystemObs: string;

  // H to K
  protectionBackFeeding: string;
  eicInspectionLetter: string;
  safetyCertificate: string;
  workCompletionReportConsumer: string;

  // L
  testReportComponents: string;

  // M. Meter Details (If arranged before Inspection)
  netMeterTotal: string;
  netMeterMake: string;
  netMeterSerial: string;
  netMeterPhase: string;
  netMeterCapacity: string;
  netMeterConstant: string;

  solarMeterTotal: string;
  solarMeterMake: string;
  solarMeterSerial: string;
  solarMeterPhase: string;
  solarMeterCapacity: string;
  solarMeterConstant: string;

  // N
  otherRemarks: string;

  // Inspection Report
  satisfactorySyncStatus: string;

  // Bottom
  observationsText: string;
  authorizedSignatoryText: string;
  signDate: string;
}
