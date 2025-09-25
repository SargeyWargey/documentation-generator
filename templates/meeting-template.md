---
name: Meeting Summary
description: Comprehensive meeting summary template for capturing discussions, decisions, and action items
category: "meeting"
version: "1.0.0"
author: "Documentation Generator"
tags: ["meeting", "summary", "notes", "action-items", "decisions"]
variables:
  - name: "meetingTitle"
    type: "string"
    required: true
    description: "Title or subject of the meeting"
    validation:
      minLength: 1
      maxLength: 150
  - name: "meetingDate"
    type: "date"
    required: true
    description: "Date when the meeting took place"
  - name: "participants"
    type: "array"
    required: true
    description: "List of meeting participants with names and roles"
    validation:
      minItems: 1
  - name: "meetingType"
    type: "select"
    required: true
    description: "Type of meeting"
    options: ["planning", "review", "standup", "retrospective", "brainstorming", "one-on-one", "all-hands", "demo", "kickoff"]
  - name: "duration"
    type: "string"
    required: false
    description: "Meeting duration"
    default: "60 minutes"
  - name: "agenda"
    type: "array"
    required: false
    description: "Meeting agenda items"
    default: []
  - name: "decisions"
    type: "array"
    required: false
    description: "Key decisions made during the meeting"
    default: []
  - name: "actionItems"
    type: "array"
    required: false
    description: "Action items with assignee and due date"
    default: []
  - name: "nextSteps"
    type: "array"
    required: false
    description: "Next steps and follow-up actions"
    default: []
  - name: "location"
    type: "string"
    required: false
    description: "Meeting location or platform"
    default: "Virtual"
  - name: "meetingHost"
    type: "string"
    required: false
    description: "Person who organized/hosted the meeting"
    default: ""
  - name: "discussionTopics"
    type: "array"
    required: false
    description: "Key discussion topics and outcomes"
    default: []
  - name: "blockers"
    type: "array"
    required: false
    description: "Identified blockers or impediments"
    default: []
  - name: "nextMeetingDate"
    type: "date"
    required: false
    description: "Date of next related meeting"
    default: ""
---

# {{meetingTitle}}

**Date**: {{meetingDate}}
**Duration**: {{duration}}
**Type**: {{meetingType}}
**Location**: {{location}}
{{#if meetingHost}}**Host**: {{meetingHost}}{{/if}}

---

## Meeting Overview

{{#if agenda}}
### Agenda
{{#agenda}}
{{@index}}. {{item}}{{#if timeAllocation}} ({{timeAllocation}}){{/if}}
{{/agenda}}
{{/if}}

## Participants

{{#participants}}
- **{{name}}**{{#if role}} - {{role}}{{/if}}{{#if department}} ({{department}}){{/if}}
{{/participants}}

{{#if discussionTopics}}
## Discussion Summary

{{#discussionTopics}}
### {{topic}}

**Discussion**: {{summary}}

{{#if outcomes}}
**Outcomes**:
{{#outcomes}}
- {{.}}
{{/outcomes}}
{{/if}}

{{#if concerns}}
**Concerns Raised**:
{{#concerns}}
- {{concern}} (Raised by: {{raisedBy}})
{{/concerns}}
{{/if}}

---

{{/discussionTopics}}
{{/if}}

## Key Decisions

{{#decisions}}
### {{decision}}

**Rationale**: {{rationale}}
**Impact**: {{impact}}
**Decision Maker**: {{decisionMaker}}
{{#if alternatives}}**Alternatives Considered**: {{alternatives}}{{/if}}

---

{{/decisions}}

{{#if blockers}}
## Blockers & Issues

{{#blockers}}
### {{blocker}}

**Impact**: {{impact}}
**Owner**: {{owner}}
**Resolution Target**: {{resolutionTarget}}
{{#if possibleSolutions}}**Possible Solutions**: {{possibleSolutions}}{{/if}}

---

{{/blockers}}
{{/if}}

## Action Items

{{#actionItems}}
- [ ] **{{task}}**
  - **Assignee**: {{assignee}}
  - **Due Date**: {{dueDate}}
  - **Priority**: {{priority}}
  {{#if dependencies}}- **Dependencies**: {{dependencies}}{{/if}}
  {{#if description}}- **Description**: {{description}}{{/if}}

{{/actionItems}}

{{#if nextSteps}}
## Next Steps

{{#nextSteps}}
{{@index}}. {{step}}{{#if timeline}} ({{timeline}}){{/if}}
{{/nextSteps}}
{{/if}}

## Follow-up Information

{{#if nextMeetingDate}}
**Next Meeting**: {{nextMeetingDate}}
{{/if}}

### Communication Plan
- **Action Item Updates**: {{#if actionItemUpdateFrequency}}{{actionItemUpdateFrequency}}{{else}}Weekly via email{{/if}}
- **Progress Reviews**: {{#if progressReviewSchedule}}{{progressReviewSchedule}}{{else}}Bi-weekly team standup{{/if}}
- **Escalation Path**: {{#if escalationPath}}{{escalationPath}}{{else}}Team lead → Project manager → Director{{/if}}

### Meeting Effectiveness

**Objectives Met**: {{#if objectivesMet}}{{objectivesMet}}{{else}}✅ Yes{{/if}}
**Time Management**: {{#if timeManagement}}{{timeManagement}}{{else}}On schedule{{/if}}
**Participation**: {{#if participationLevel}}{{participationLevel}}{{else}}All participants engaged{{/if}}

{{#if meetingFeedback}}
### Feedback & Improvements

{{#meetingFeedback}}
- **{{feedback}}** ({{source}})
{{/meetingFeedback}}
{{/if}}

---

## Meeting Artifacts

{{#if sharedDocuments}}
### Shared Documents
{{#sharedDocuments}}
- [{{title}}]({{link}}) - {{description}}
{{/sharedDocuments}}
{{/if}}

{{#if recordings}}
### Recording
- **Meeting Recording**: [Available here]({{recordings}})
- **Access**: {{recordingAccess}}
- **Retention**: {{recordingRetention}}
{{/if}}

{{#if presentations}}
### Presentations
{{#presentations}}
- **{{title}}** by {{presenter}} - [View slides]({{link}})
{{/presentations}}
{{/if}}

---

## Attendee Notes

{{#if attendeeNotes}}
{{#attendeeNotes}}
### {{attendee}}
{{notes}}

{{/attendeeNotes}}
{{/if}}

---

**Meeting Notes Prepared By**: {{#if notesTaker}}{{notesTaker}}{{else}}Meeting Host{{/if}}
**Distribution**: {{#if distributionList}}{{distributionList}}{{else}}All participants{{/if}}
**Last Updated**: {{currentDate}}

### Archive Information
- **Meeting Series**: {{#if meetingSeries}}{{meetingSeries}}{{else}}Standalone{{/if}}
- **Related Meetings**: {{#if relatedMeetings}}{{relatedMeetings}}{{else}}None{{/if}}
- **Storage Location**: {{#if storageLocation}}{{storageLocation}}{{else}}Team shared drive{{/if}}