// Document Generator exports
export { HelpDocumentationGenerator } from './HelpDocumentationGenerator';
export { PRDGenerator } from './PRDGenerator';
export { TechnicalSpecGenerator } from './TechnicalSpecGenerator';
export { MeetingSummaryGenerator } from './MeetingSummaryGenerator';

// Type exports for HelpDocumentationGenerator
export type {
  HelpDocumentationOptions,
  APIDocumentation,
  FeatureAnalysis,
  GettingStartedSection,
  TroubleshootingEntry,
  FAQEntry,
} from './HelpDocumentationGenerator';

// Type exports for PRDGenerator
export type {
  PRDGenerationOptions,
  FeatureRequirement,
  UserStory,
  AcceptanceCriteria,
  DependencyMapping,
  SuccessMetrics,
  TimelineEstimation,
} from './PRDGenerator';

// Type exports for TechnicalSpecGenerator
export type {
  TechnicalSpecOptions,
  ArchitectureAnalysis,
  APISpecification,
  DatabaseSchema,
  ConfigurationDocumentation,
  DeploymentDocumentation,
  TestingStrategy,
  IntegrationMapping,
} from './TechnicalSpecGenerator';

// Type exports for MeetingSummaryGenerator
export type {
  MeetingSummaryOptions,
  MeetingContext,
  Participant,
  ActionItem,
  Decision,
  FollowUpTask,
  MeetingNotes,
  MeetingSeries,
} from './MeetingSummaryGenerator';
