---
name: "Product Requirements Document"
description: "Comprehensive PRD template for product planning and stakeholder alignment"
category: "planning"
version: "1.0.0"
author: "Documentation Generator"
tags: ["prd", "product", "requirements", "planning", "stakeholders"]
variables:
  - name: "productName"
    type: "string"
    required: true
    description: "Name of the product or feature"
    validation:
      minLength: 1
      maxLength: 100
  - name: "productVision"
    type: "string"
    required: true
    description: "High-level vision statement for the product"
    validation:
      minLength: 10
      maxLength: 500
  - name: "targetAudience"
    type: "array"
    required: true
    description: "Primary target audience segments"
    validation:
      minItems: 1
  - name: "businessGoals"
    type: "array"
    required: true
    description: "Key business objectives this product addresses"
    validation:
      minItems: 1
  - name: "userStories"
    type: "array"
    required: false
    description: "User stories with role, want, benefit, and acceptance criteria"
    default: []
  - name: "acceptanceCriteria"
    type: "array"
    required: false
    description: "Global acceptance criteria for the product"
    default: []
  - name: "successMetrics"
    type: "array"
    required: false
    description: "Key performance indicators and success metrics"
    default: []
  - name: "timeline"
    type: "string"
    required: false
    description: "Project timeline and key milestones"
    default: "TBD"
  - name: "stakeholders"
    type: "array"
    required: false
    description: "Key stakeholders and their roles"
    default: []
  - name: "projectDescription"
    type: "string"
    required: false
    description: "Detailed project description from analysis"
    default: ""
  - name: "dependencies"
    type: "array"
    required: false
    description: "External dependencies and integrations"
    default: []
  - name: "riskAssessment"
    type: "array"
    required: false
    description: "Identified risks and mitigation strategies"
    default: []
---

# {{productName}} - Product Requirements Document

## Executive Summary

{{productVision}}

{{#if projectDescription}}
## Project Overview

{{projectDescription}}
{{/if}}

## Target Audience

{{#targetAudience}}
- **{{name}}**: {{description}}
{{/targetAudience}}

## Business Goals & Objectives

{{#businessGoals}}
- {{goal}}: {{rationale}}
{{/businessGoals}}

## Product Requirements

### Functional Requirements

{{#userStories}}
#### {{title}}

**As a** {{role}}
**I want** {{want}}
**So that** {{benefit}}

**Acceptance Criteria:**
{{#acceptanceCriteria}}
- {{.}}
{{/acceptanceCriteria}}

**Priority**: {{priority}}
**Story Points**: {{storyPoints}}

---
{{/userStories}}

{{#if acceptanceCriteria}}
### Global Acceptance Criteria

{{#acceptanceCriteria}}
- {{.}}
{{/acceptanceCriteria}}
{{/if}}

### Non-Functional Requirements

{{#if dependencies}}
#### Dependencies & Integrations

{{#dependencies}}
- **{{name}}**: {{description}} ({{type}})
{{/dependencies}}
{{/if}}

#### Performance Requirements
- Response time: < 2 seconds for core operations
- Availability: 99.9% uptime
- Scalability: Support concurrent users as defined in business goals

#### Security Requirements
- Data encryption in transit and at rest
- User authentication and authorization
- Compliance with relevant data protection regulations

## Success Metrics

{{#successMetrics}}
- **{{metric}}**: {{target}} ({{measurement}})
{{/successMetrics}}

{{#if timeline}}
## Timeline & Milestones

{{timeline}}

### Key Deliverables
- MVP Definition: Week 2
- Design Phase: Week 4
- Development Sprint 1: Week 6
- Beta Testing: Week 10
- Production Release: Week 12
{{/if}}

## Stakeholders & Responsibilities

{{#stakeholders}}
- **{{name}}** ({{role}}): {{responsibilities}}
{{/stakeholders}}

{{#if riskAssessment}}
## Risk Assessment

{{#riskAssessment}}
### {{risk}}
- **Impact**: {{impact}}
- **Probability**: {{probability}}
- **Mitigation**: {{mitigation}}

{{/riskAssessment}}
{{/if}}

## Out of Scope

The following items are explicitly out of scope for this release:
- Advanced analytics and reporting features
- Third-party integrations beyond specified dependencies
- Mobile application development (unless specified)
- Legacy system migration (unless specified)

## Approval & Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | | | |
| Engineering Lead | | | |
| Design Lead | | | |
| Business Stakeholder | | | |

---

**Document Version**: 1.0
**Last Updated**: {{currentDate}}
**Next Review**: {{nextReviewDate}}