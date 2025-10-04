import { FolderContext } from '../utils/FolderAnalyzer';
import { TemplateManager } from '../templates/TemplateManager';
import { ClaudeIntegrator } from '../commands/ClaudeIntegrator';

export interface MeetingSummaryOptions {
  includeActionItems: boolean;
  includeDecisionTracking: boolean;
  includeFollowUpTasks: boolean;
  includeParticipantTracking: boolean;
  includeMeetingNotes: boolean;
  includeSeriesTracking: boolean;
  meetingType: 'standup' | 'planning' | 'retrospective' | 'review' | 'general';
  outputFormat: 'markdown' | 'confluence' | 'notion' | 'email';
  templateName?: string;
}

export interface MeetingContext {
  title: string;
  date: string;
  duration: string;
  meetingType: string;
  participants: Participant[];
  agenda: string[];
  objectives: string[];
  relatedProject?: string;
  meetingSeriesId?: string;
}

export interface Participant {
  name: string;
  role: string;
  department?: string;
  attendance: 'present' | 'absent' | 'partial';
  contributions: string[];
  actionItemsAssigned: number;
  expertise: string[];
}

export interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  category: string;
  dependencies: string[];
  estimatedEffort: string;
  relatedDecisions: string[];
  followUpRequired: boolean;
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  rationale: string;
  alternatives: Array<{
    option: string;
    pros: string[];
    cons: string[];
    rejected: boolean;
    reason?: string;
  }>;
  impact: 'high' | 'medium' | 'low';
  stakeholders: string[];
  implementationDate?: string;
  reviewDate?: string;
  status: 'proposed' | 'approved' | 'implemented' | 'rejected';
  criteria: string[];
  risks: string[];
}

export interface FollowUpTask {
  id: string;
  description: string;
  type: 'research' | 'implementation' | 'communication' | 'review' | 'decision';
  assignee: string;
  requester: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  context: string;
  deliverable: string;
  successCriteria: string[];
  resources: string[];
  blockers: string[];
}

export interface MeetingNotes {
  keyTopics: Array<{
    topic: string;
    discussion: string;
    outcomes: string[];
    nextSteps: string[];
  }>;
  importantQuotes: Array<{
    speaker: string;
    quote: string;
    context: string;
    significance: string;
  }>;
  concerns: Array<{
    concern: string;
    raisedBy: string;
    impact: string;
    proposedSolutions: string[];
  }>;
  achievements: Array<{
    achievement: string;
    contributors: string[];
    impact: string;
  }>;
  challenges: Array<{
    challenge: string;
    impact: string;
    proposedSolutions: string[];
    owner: string;
  }>;
}

export interface MeetingSeries {
  seriesId: string;
  name: string;
  purpose: string;
  frequency: string;
  participants: string[];
  recurringTopics: string[];
  previousMeetings: Array<{
    date: string;
    keyOutcomes: string[];
    actionItemsCompleted: number;
    attendanceRate: number;
  }>;
  trends: Array<{
    metric: string;
    trend: 'improving' | 'declining' | 'stable';
    description: string;
  }>;
  effectiveness: {
    actionItemCompletionRate: number;
    decisionImplementationRate: number;
    participantSatisfaction: number;
    timeUtilization: number;
  };
}

export class MeetingSummaryGenerator {
  private templateManager: TemplateManager;
  private claudeIntegrator: ClaudeIntegrator;

  constructor(
    templateManager: TemplateManager,
    claudeIntegrator: ClaudeIntegrator
  ) {
    this.templateManager = templateManager;
    this.claudeIntegrator = claudeIntegrator;
  }

  async generateMeetingSummary(
    meetingContext: MeetingContext,
    discussionContent: string,
    _analysisResult?: FolderContext,
    options: MeetingSummaryOptions = this.getDefaultOptions()
  ): Promise<string> {
    const sections: string[] = [];

    // Generate meeting header
    const header = this.generateMeetingHeader(meetingContext);
    sections.push(header);

    // Generate participant summary
    const participantSummary = this.generateParticipantSummary(
      meetingContext.participants
    );
    sections.push(participantSummary);

    if (options.includeMeetingNotes) {
      const notes = await this.extractMeetingNotes(
        discussionContent,
        meetingContext
      );
      sections.push(this.formatMeetingNotes(notes));
    }

    if (options.includeActionItems) {
      const actionItems = await this.extractActionItems(
        discussionContent,
        meetingContext
      );
      sections.push(this.formatActionItems(actionItems));
    }

    if (options.includeDecisionTracking) {
      const decisions = await this.extractDecisions(
        discussionContent,
        meetingContext
      );
      sections.push(this.formatDecisions(decisions));
    }

    if (options.includeFollowUpTasks) {
      const followUpTasks = await this.generateFollowUpTasks(
        discussionContent,
        meetingContext
      );
      sections.push(this.formatFollowUpTasks(followUpTasks));
    }

    if (options.includeParticipantTracking) {
      const participantInsights = await this.analyzeParticipantContributions(
        discussionContent,
        meetingContext.participants
      );
      sections.push(this.formatParticipantInsights(participantInsights));
    }

    if (options.includeSeriesTracking && meetingContext.meetingSeriesId) {
      const seriesAnalysis = await this.analyzeMeetingSeries(
        meetingContext.meetingSeriesId
      );
      sections.push(this.formatSeriesAnalysis(seriesAnalysis));
    }

    const templateName = options.templateName || 'meeting-template';
    const template = await this.templateManager.loadTemplate(templateName);

    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    // Map meeting data to template variables
    const templateVariables = {
      meetingTitle: meetingContext.title,
      meetingDate: meetingContext.date,
      meetingType: options.meetingType,
      duration: meetingContext.duration,
      participants: meetingContext.participants.map((p) => ({
        name: p.name,
        role: p.role,
      })),
      agenda: meetingContext.agenda,
      decisions: options.includeDecisionTracking
        ? await this.extractDecisions(discussionContent, meetingContext)
        : [],
      actionItems: options.includeActionItems
        ? await this.extractActionItems(discussionContent, meetingContext)
        : [],
      nextSteps: options.includeFollowUpTasks
        ? await this.generateFollowUpTasks(discussionContent, meetingContext)
        : [],
      analysis: {
        participantCount: meetingContext.participants.length,
        meetingType: options.meetingType,
        hasActionItems: options.includeActionItems,
        hasDecisions: options.includeDecisionTracking,
      },
    };

    return await this.templateManager.processTemplateContent(
      template.content,
      templateVariables
    );
  }

  async extractActionItems(
    discussionContent: string,
    context: MeetingContext
  ): Promise<ActionItem[]> {
    const actionItems: ActionItem[] = [];

    // Extract action items from discussion content
    const actionPatterns = [
      /action\s*item[:\s]*([^.!?]+)/gi,
      /(?:will|should|need to|must)\s+([^.!?]+)/gi,
      /(?:assigned to|@)(\w+)[:\s]*([^.!?]+)/gi,
      /(?:by|due)\s+(\d{1,2}\/\d{1,2}|\w+day)[:\s]*([^.!?]+)/gi,
    ];

    let actionId = 1;

    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(discussionContent)) !== null) {
        const description = match[1]?.trim();
        if (description && description.length > 10) {
          const actionItem: ActionItem = {
            id: `AI-${context.date.replace(/[^\d]/g, '')}-${actionId.toString().padStart(3, '0')}`,
            description: this.cleanActionDescription(description),
            assignee: this.extractAssignee(match[0], context.participants),
            dueDate: this.extractDueDate(match[0]),
            priority: this.inferPriority(description, discussionContent),
            status: 'pending',
            category: this.categorizeActionItem(description),
            dependencies: this.extractDependencies(description, actionItems),
            estimatedEffort: this.estimateEffort(description),
            relatedDecisions: [],
            followUpRequired: this.requiresFollowUp(description),
          };

          actionItems.push(actionItem);
          actionId++;
        }
      }
    }

    // Enhance action items with context
    return this.enhanceActionItems(actionItems, discussionContent, context);
  }

  private cleanActionDescription(description: string): string {
    return description
      .replace(/^(will|should|need to|must)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[^a-zA-Z]*/, '') // Remove leading non-alphabetic characters
      .replace(/[^.!?]*$/, (match) =>
        match.endsWith('.') ? match : match + '.'
      );
  }

  private extractAssignee(text: string, participants: Participant[]): string {
    // Look for @ mentions or "assigned to" patterns
    const assigneeMatch = text.match(/@(\w+)|assigned\s+to\s+(\w+)/i);
    if (assigneeMatch) {
      const name = assigneeMatch[1] || assigneeMatch[2];
      const participant = participants.find((p) =>
        p.name.toLowerCase().includes(name.toLowerCase())
      );
      return participant?.name || name;
    }

    // Default to first participant if no assignee found
    return participants.length > 0 ? participants[0].name : 'Unassigned';
  }

  private extractDueDate(text: string): string {
    const dueDateMatch = text.match(/(?:by|due)\s+(\d{1,2}\/\d{1,2}|\w+day)/i);
    if (dueDateMatch) {
      return this.parseDueDate(dueDateMatch[1]);
    }

    // Default to one week from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    return defaultDate.toISOString().split('T')[0];
  }

  private parseDueDate(dateStr: string): string {
    if (dateStr.includes('/')) {
      // Handle MM/DD format
      const [month, day] = dateStr.split('/').map(Number);
      const year = new Date().getFullYear();
      const date = new Date(year, month - 1, day);
      return date.toISOString().split('T')[0];
    }

    if (dateStr.toLowerCase().includes('day')) {
      // Handle relative dates like "friday", "monday"
      const days = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ];
      const targetDay = days.findIndex((day) =>
        dateStr.toLowerCase().includes(day.toLowerCase())
      );

      if (targetDay !== -1) {
        const date = this.getNextWeekday(targetDay);
        return date.toISOString().split('T')[0];
      }
    }

    // Default fallback
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    return defaultDate.toISOString().split('T')[0];
  }

  private getNextWeekday(targetDay: number): Date {
    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilTarget = (targetDay + 7 - currentDay) % 7;
    const targetDate = new Date(today);
    targetDate.setDate(
      today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget)
    );
    return targetDate;
  }

  private inferPriority(
    description: string,
    context: string
  ): 'high' | 'medium' | 'low' {
    const highPriorityKeywords = [
      'urgent',
      'critical',
      'asap',
      'immediately',
      'blocker',
      'high priority',
    ];
    const mediumPriorityKeywords = [
      'important',
      'needed',
      'required',
      'should',
    ];

    const text = (description + ' ' + context).toLowerCase();

    if (highPriorityKeywords.some((keyword) => text.includes(keyword))) {
      return 'high';
    }
    if (mediumPriorityKeywords.some((keyword) => text.includes(keyword))) {
      return 'medium';
    }
    return 'low';
  }

  private categorizeActionItem(description: string): string {
    const categories = {
      research: ['research', 'investigate', 'analyze', 'study', 'explore'],
      implementation: ['implement', 'build', 'create', 'develop', 'code'],
      communication: [
        'email',
        'call',
        'inform',
        'notify',
        'share',
        'communicate',
      ],
      review: ['review', 'check', 'validate', 'approve', 'verify'],
      planning: ['plan', 'schedule', 'organize', 'prepare'],
      documentation: ['document', 'write', 'update', 'record'],
    };

    const lowerDesc = description.toLowerCase();

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((keyword) => lowerDesc.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  private extractDependencies(
    description: string,
    _existingItems: ActionItem[]
  ): string[] {
    const dependencies: string[] = [];

    // Look for references to other action items
    const referencePatterns = [
      /after\s+([^,\.]+)/gi,
      /depends\s+on\s+([^,\.]+)/gi,
      /once\s+([^,\.]+)/gi,
    ];

    for (const pattern of referencePatterns) {
      let match;
      while ((match = pattern.exec(description)) !== null) {
        const dependency = match[1].trim();
        dependencies.push(dependency);
      }
    }

    return dependencies;
  }

  private estimateEffort(description: string): string {
    const effortKeywords = {
      quick: '1 hour',
      simple: '2 hours',
      small: '4 hours',
      medium: '1 day',
      large: '3 days',
      complex: '1 week',
      major: '2 weeks',
    };

    const lowerDesc = description.toLowerCase();

    for (const [keyword, effort] of Object.entries(effortKeywords)) {
      if (lowerDesc.includes(keyword)) {
        return effort;
      }
    }

    // Default estimation based on description length
    if (description.length < 50) {
      return '2 hours';
    }
    if (description.length < 100) {
      return '4 hours';
    }
    return '1 day';
  }

  private requiresFollowUp(description: string): boolean {
    const followUpKeywords = [
      'follow up',
      'check back',
      'monitor',
      'track',
      'review progress',
    ];
    const lowerDesc = description.toLowerCase();
    return followUpKeywords.some((keyword) => lowerDesc.includes(keyword));
  }

  private enhanceActionItems(
    actionItems: ActionItem[],
    discussionContent: string,
    _context: MeetingContext
  ): ActionItem[] {
    // Link action items to decisions and enhance with context
    return actionItems.map((item) => ({
      ...item,
      relatedDecisions: this.findRelatedDecisions(
        item.description,
        discussionContent
      ),
    }));
  }

  private findRelatedDecisions(
    actionDescription: string,
    discussionContent: string
  ): string[] {
    const decisions: string[] = [];

    // Look for decision patterns that relate to the action
    const decisionPatterns = [
      /we\s+(?:decided|agreed)\s+(?:to\s+)?([^.!?]+)/gi,
      /decision[:\s]*([^.!?]+)/gi,
      /agreed\s+(?:that\s+)?([^.!?]+)/gi,
    ];

    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(discussionContent)) !== null) {
        const decision = match[1].trim();
        if (this.isRelatedToAction(decision, actionDescription)) {
          decisions.push(decision);
        }
      }
    }

    return decisions;
  }

  private isRelatedToAction(decision: string, action: string): boolean {
    const decisionWords = decision.toLowerCase().split(/\s+/);
    const actionWords = action.toLowerCase().split(/\s+/);

    // Check for word overlap
    const overlap = decisionWords.filter(
      (word) => actionWords.includes(word) && word.length > 3
    );

    return overlap.length >= 2;
  }

  async extractDecisions(
    discussionContent: string,
    context: MeetingContext
  ): Promise<Decision[]> {
    const decisions: Decision[] = [];

    // Extract decisions from discussion content
    const decisionPatterns = [
      /(?:we\s+)?(?:decided|agreed)\s+(?:to\s+|that\s+)?([^.!?]+)/gi,
      /decision[:\s]*([^.!?]+)/gi,
      /(?:conclusion|resolution)[:\s]*([^.!?]+)/gi,
    ];

    let decisionId = 1;

    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(discussionContent)) !== null) {
        const title = match[1]?.trim();
        if (title && title.length > 10) {
          const decision: Decision = {
            id: `DEC-${context.date.replace(/[^\d]/g, '')}-${decisionId.toString().padStart(3, '0')}`,
            title: this.cleanDecisionTitle(title),
            description: this.extractDecisionDescription(
              title,
              discussionContent
            ),
            rationale: this.extractRationale(title, discussionContent),
            alternatives: this.extractAlternatives(title, discussionContent),
            impact: this.assessDecisionImpact(title, discussionContent),
            stakeholders: this.extractStakeholders(title, context.participants),
            status: 'approved',
            criteria: this.extractDecisionCriteria(title, discussionContent),
            risks: this.extractDecisionRisks(title, discussionContent),
          };

          decisions.push(decision);
          decisionId++;
        }
      }
    }

    return decisions;
  }

  private cleanDecisionTitle(title: string): string {
    return title
      .replace(/^(to\s+|that\s+)/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[^a-zA-Z]*/, '')
      .slice(0, 100); // Limit length
  }

  private extractDecisionDescription(title: string, content: string): string {
    // Find the context around the decision
    const titleIndex = content.toLowerCase().indexOf(title.toLowerCase());
    if (titleIndex !== -1) {
      const start = Math.max(0, titleIndex - 200);
      const end = Math.min(content.length, titleIndex + title.length + 200);
      return content.slice(start, end).trim();
    }
    return title;
  }

  private extractRationale(title: string, content: string): string {
    const rationalePatterns = [
      /because\s+([^.!?]+)/gi,
      /since\s+([^.!?]+)/gi,
      /(?:the\s+)?reason\s+(?:is\s+)?([^.!?]+)/gi,
    ];

    for (const pattern of rationalePatterns) {
      const match = pattern.exec(content);
      if (match && this.isNearText(match.index!, title, content)) {
        return match[1].trim();
      }
    }

    return 'Rationale not explicitly stated in discussion.';
  }

  private extractAlternatives(
    title: string,
    content: string
  ): Array<{
    option: string;
    pros: string[];
    cons: string[];
    rejected: boolean;
    reason?: string;
  }> {
    const alternatives: any[] = [];

    const alternativePatterns = [
      /(?:alternative|option|choice)[:\s]*([^.!?]+)/gi,
      /(?:could\s+also|instead\s+of)[:\s]*([^.!?]+)/gi,
    ];

    for (const pattern of alternativePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (this.isNearText(match.index!, title, content)) {
          alternatives.push({
            option: match[1].trim(),
            pros: [],
            cons: [],
            rejected: true,
            reason: 'Not selected in favor of current decision',
          });
        }
      }
    }

    return alternatives;
  }

  private assessDecisionImpact(
    title: string,
    content: string
  ): 'high' | 'medium' | 'low' {
    const highImpactKeywords = [
      'critical',
      'major',
      'significant',
      'substantial',
      'strategic',
    ];
    const mediumImpactKeywords = ['important', 'moderate', 'notable'];

    const text = (title + ' ' + content).toLowerCase();

    if (highImpactKeywords.some((keyword) => text.includes(keyword))) {
      return 'high';
    }
    if (mediumImpactKeywords.some((keyword) => text.includes(keyword))) {
      return 'medium';
    }
    return 'low';
  }

  private extractStakeholders(
    _title: string,
    participants: Participant[]
  ): string[] {
    // Default to all participants for now
    return participants.map((p) => p.name);
  }

  private extractDecisionCriteria(title: string, content: string): string[] {
    const criteria: string[] = [];

    const criteriaPatterns = [
      /(?:criteria|requirements?)[:\s]*([^.!?]+)/gi,
      /(?:must|should)\s+([^.!?]+)/gi,
    ];

    for (const pattern of criteriaPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (this.isNearText(match.index!, title, content)) {
          criteria.push(match[1].trim());
        }
      }
    }

    return criteria;
  }

  private extractDecisionRisks(title: string, content: string): string[] {
    const risks: string[] = [];

    const riskPatterns = [
      /(?:risk|concern|issue)[:\s]*([^.!?]+)/gi,
      /(?:might|could)\s+(?:cause|lead\s+to)[:\s]*([^.!?]+)/gi,
    ];

    for (const pattern of riskPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (this.isNearText(match.index!, title, content)) {
          risks.push(match[1].trim());
        }
      }
    }

    return risks;
  }

  private isNearText(
    index: number,
    targetText: string,
    content: string
  ): boolean {
    const targetIndex = content.toLowerCase().indexOf(targetText.toLowerCase());
    if (targetIndex === -1) {
      return false;
    }

    const distance = Math.abs(index - targetIndex);
    return distance < 500; // Within 500 characters
  }

  async generateFollowUpTasks(
    discussionContent: string,
    context: MeetingContext
  ): Promise<FollowUpTask[]> {
    const followUpTasks: FollowUpTask[] = [];

    // Extract follow-up tasks from discussion
    const followUpPatterns = [
      /follow\s+up\s+(?:on\s+|with\s+)?([^.!?]+)/gi,
      /need\s+to\s+(?:check|verify|confirm|research)\s+([^.!?]+)/gi,
      /(?:will\s+)?(?:investigate|explore|look\s+into)\s+([^.!?]+)/gi,
    ];

    let taskId = 1;

    for (const pattern of followUpPatterns) {
      let match;
      while ((match = pattern.exec(discussionContent)) !== null) {
        const description = match[1]?.trim();
        if (description && description.length > 10) {
          const task: FollowUpTask = {
            id: `FU-${context.date.replace(/[^\d]/g, '')}-${taskId.toString().padStart(3, '0')}`,
            description: this.cleanTaskDescription(description),
            type: this.categorizeFollowUpTask(description),
            assignee: this.extractTaskAssignee(match[0], context.participants),
            requester: context.participants[0]?.name || 'Meeting Organizer',
            dueDate: this.calculateFollowUpDueDate(),
            priority: this.inferTaskPriority(description),
            context: this.extractTaskContext(description, discussionContent),
            deliverable: this.inferDeliverable(description),
            successCriteria: this.generateSuccessCriteria(description),
            resources: this.identifyRequiredResources(description),
            blockers: this.identifyPotentialBlockers(description),
          };

          followUpTasks.push(task);
          taskId++;
        }
      }
    }

    return followUpTasks;
  }

  private cleanTaskDescription(description: string): string {
    return description
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[^a-zA-Z]*/, '')
      .replace(/[^.!?]*$/, (match) =>
        match.endsWith('.') ? match : match + '.'
      );
  }

  private categorizeFollowUpTask(
    description: string
  ): 'research' | 'implementation' | 'communication' | 'review' | 'decision' {
    const categories = {
      research: [
        'research',
        'investigate',
        'analyze',
        'study',
        'explore',
        'look into',
      ],
      implementation: ['implement', 'build', 'create', 'develop', 'setup'],
      communication: [
        'contact',
        'email',
        'call',
        'inform',
        'notify',
        'coordinate',
      ],
      review: ['review', 'check', 'verify', 'validate', 'confirm'],
      decision: ['decide', 'choose', 'determine', 'select'],
    };

    const lowerDesc = description.toLowerCase();

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((keyword) => lowerDesc.includes(keyword))) {
        return category as
          | 'research'
          | 'implementation'
          | 'communication'
          | 'review'
          | 'decision';
      }
    }

    return 'research'; // Default
  }

  private extractTaskAssignee(
    text: string,
    participants: Participant[]
  ): string {
    // Similar to action item assignee extraction
    return this.extractAssignee(text, participants);
  }

  private calculateFollowUpDueDate(): string {
    // Default to 3 days for follow-up tasks
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toISOString().split('T')[0];
  }

  private inferTaskPriority(description: string): 'high' | 'medium' | 'low' {
    return this.inferPriority(description, '');
  }

  private extractTaskContext(description: string, fullContent: string): string {
    const descIndex = fullContent
      .toLowerCase()
      .indexOf(description.toLowerCase());
    if (descIndex !== -1) {
      const start = Math.max(0, descIndex - 100);
      const end = Math.min(
        fullContent.length,
        descIndex + description.length + 100
      );
      return fullContent.slice(start, end).trim();
    }
    return description;
  }

  private inferDeliverable(description: string): string {
    if (description.toLowerCase().includes('research')) {
      return 'Research findings and recommendations';
    }
    if (description.toLowerCase().includes('implement')) {
      return 'Implementation plan or completed feature';
    }
    if (description.toLowerCase().includes('review')) {
      return 'Review results and feedback';
    }
    if (
      description.toLowerCase().includes('contact') ||
      description.toLowerCase().includes('email')
    ) {
      return 'Communication confirmation and response';
    }
    return 'Task completion report';
  }

  private generateSuccessCriteria(_description: string): string[] {
    return [
      'Task completed within specified timeframe',
      'Deliverable meets quality standards',
      'Stakeholders informed of completion',
    ];
  }

  private identifyRequiredResources(description: string): string[] {
    const resources: string[] = [];

    if (description.toLowerCase().includes('research')) {
      resources.push(
        'Access to documentation',
        'Research tools',
        'Subject matter experts'
      );
    }
    if (description.toLowerCase().includes('implement')) {
      resources.push(
        'Development environment',
        'Technical specifications',
        'Testing resources'
      );
    }
    if (
      description.toLowerCase().includes('coordinate') ||
      description.toLowerCase().includes('contact')
    ) {
      resources.push(
        'Contact information',
        'Communication channels',
        'Calendar access'
      );
    }

    return resources.length > 0 ? resources : ['Standard work resources'];
  }

  private identifyPotentialBlockers(_description: string): string[] {
    return [
      'Waiting for external dependencies',
      'Resource availability constraints',
      'Approval or decision dependencies',
    ];
  }

  async extractMeetingNotes(
    discussionContent: string,
    context: MeetingContext
  ): Promise<MeetingNotes> {
    const keyTopics = await this.extractKeyTopics(discussionContent);
    const importantQuotes = await this.extractImportantQuotes(
      discussionContent,
      context.participants
    );
    const concerns = await this.extractConcerns(
      discussionContent,
      context.participants
    );
    const achievements = await this.extractAchievements(
      discussionContent,
      context.participants
    );
    const challenges = await this.extractChallenges(
      discussionContent,
      context.participants
    );

    return {
      keyTopics,
      importantQuotes,
      concerns,
      achievements,
      challenges,
    };
  }

  private async extractKeyTopics(content: string): Promise<any[]> {
    const topics: any[] = [];

    // Split content into logical sections
    const sections = content.split(/\n\s*\n/);

    for (const section of sections) {
      if (section.trim().length > 100) {
        const topic = {
          topic: this.extractTopicTitle(section),
          discussion: section.slice(0, 300) + '...',
          outcomes: this.extractOutcomes(section),
          nextSteps: this.extractNextSteps(section),
        };

        topics.push(topic);
      }
    }

    return topics.slice(0, 5); // Limit to top 5 topics
  }

  private extractTopicTitle(section: string): string {
    const sentences = section.split(/[.!?]/);
    const firstSentence = sentences[0]?.trim();

    if (firstSentence && firstSentence.length < 100) {
      return firstSentence;
    }

    // Extract from first few words
    const words = section.split(/\s+/).slice(0, 8);
    return words.join(' ') + '...';
  }

  private extractOutcomes(section: string): string[] {
    const outcomes: string[] = [];

    const outcomePatterns = [
      /(?:outcome|result|conclusion)[:\s]*([^.!?]+)/gi,
      /(?:we\s+)?(?:decided|agreed|concluded)\s+([^.!?]+)/gi,
    ];

    for (const pattern of outcomePatterns) {
      let match;
      while ((match = pattern.exec(section)) !== null) {
        outcomes.push(match[1].trim());
      }
    }

    return outcomes;
  }

  private extractNextSteps(section: string): string[] {
    const nextSteps: string[] = [];

    const stepPatterns = [
      /next\s+step[s]?[:\s]*([^.!?]+)/gi,
      /(?:will|should|need\s+to)\s+([^.!?]+)/gi,
    ];

    for (const pattern of stepPatterns) {
      let match;
      while ((match = pattern.exec(section)) !== null) {
        nextSteps.push(match[1].trim());
      }
    }

    return nextSteps;
  }

  private async extractImportantQuotes(
    content: string,
    participants: Participant[]
  ): Promise<any[]> {
    const quotes: any[] = [];

    // Look for quoted text or emphatic statements
    const quotePatterns = [
      /"([^"]+)"/g,
      /'([^']+)'/g,
      /([A-Z][^.!?]*(?:important|critical|key|essential)[^.!?]*[.!?])/gi,
    ];

    for (const pattern of quotePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const quote = match[1]?.trim();
        if (quote && quote.length > 20 && quote.length < 200) {
          quotes.push({
            speaker: this.inferSpeaker(match.index!, content, participants),
            quote,
            context: this.extractQuoteContext(match.index!, content),
            significance: this.assessQuoteSignificance(quote),
          });
        }
      }
    }

    return quotes.slice(0, 3); // Limit to top 3 quotes
  }

  private inferSpeaker(
    index: number,
    content: string,
    participants: Participant[]
  ): string {
    // Look for speaker indicators before the quote
    const precedingText = content.slice(Math.max(0, index - 100), index);

    for (const participant of participants) {
      if (
        precedingText.toLowerCase().includes(participant.name.toLowerCase())
      ) {
        return participant.name;
      }
    }

    return 'Unknown Speaker';
  }

  private extractQuoteContext(index: number, content: string): string {
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + 100);
    return content.slice(start, end).trim();
  }

  private assessQuoteSignificance(quote: string): string {
    const significanceKeywords = {
      strategic: ['strategy', 'direction', 'vision', 'goal'],
      technical: ['technical', 'architecture', 'implementation', 'code'],
      business: ['business', 'revenue', 'customer', 'market'],
      process: ['process', 'workflow', 'procedure', 'method'],
    };

    const lowerQuote = quote.toLowerCase();

    for (const [significance, keywords] of Object.entries(
      significanceKeywords
    )) {
      if (keywords.some((keyword) => lowerQuote.includes(keyword))) {
        return `${significance} insight`;
      }
    }

    return 'General observation';
  }

  private async extractConcerns(
    content: string,
    participants: Participant[]
  ): Promise<any[]> {
    const concerns: any[] = [];

    const concernPatterns = [
      /(?:concern|worry|issue|problem)[:\s]*([^.!?]+)/gi,
      /(?:worried|concerned)\s+(?:about\s+)?([^.!?]+)/gi,
      /(?:risk|challenge)\s+(?:is\s+|of\s+)?([^.!?]+)/gi,
    ];

    for (const pattern of concernPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const concern = match[1]?.trim();
        if (concern && concern.length > 10) {
          concerns.push({
            concern,
            raisedBy: this.inferSpeaker(match.index!, content, participants),
            impact: this.assessConcernImpact(concern),
            proposedSolutions: this.extractProposedSolutions(concern, content),
          });
        }
      }
    }

    return concerns;
  }

  private assessConcernImpact(concern: string): string {
    const highImpactKeywords = ['critical', 'major', 'serious', 'significant'];
    const mediumImpactKeywords = ['moderate', 'notable', 'important'];

    const lowerConcern = concern.toLowerCase();

    if (highImpactKeywords.some((keyword) => lowerConcern.includes(keyword))) {
      return 'High impact on project timeline and deliverables';
    }
    if (
      mediumImpactKeywords.some((keyword) => lowerConcern.includes(keyword))
    ) {
      return 'Medium impact requiring attention';
    }
    return 'Low to medium impact, manageable with proper planning';
  }

  private extractProposedSolutions(concern: string, content: string): string[] {
    const solutions: string[] = [];

    const solutionPatterns = [
      /(?:solution|fix|resolve)[:\s]*([^.!?]+)/gi,
      /(?:could|should|might)\s+([^.!?]+)/gi,
    ];

    for (const pattern of solutionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (this.isNearText(match.index!, concern, content)) {
          solutions.push(match[1].trim());
        }
      }
    }

    return solutions.slice(0, 3);
  }

  private async extractAchievements(
    content: string,
    participants: Participant[]
  ): Promise<any[]> {
    const achievements: any[] = [];

    const achievementPatterns = [
      /(?:achieved|accomplished|completed|delivered)\s+([^.!?]+)/gi,
      /(?:success|win|milestone)[:\s]*([^.!?]+)/gi,
      /(?:finished|done\s+with)\s+([^.!?]+)/gi,
    ];

    for (const pattern of achievementPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const achievement = match[1]?.trim();
        if (achievement && achievement.length > 10) {
          achievements.push({
            achievement,
            contributors: this.extractContributors(
              achievement,
              content,
              participants
            ),
            impact: this.assessAchievementImpact(achievement),
          });
        }
      }
    }

    return achievements;
  }

  private extractContributors(
    achievement: string,
    content: string,
    participants: Participant[]
  ): string[] {
    const contributors: string[] = [];

    // Look for names mentioned near the achievement
    const achievementIndex = content
      .toLowerCase()
      .indexOf(achievement.toLowerCase());
    if (achievementIndex !== -1) {
      const contextStart = Math.max(0, achievementIndex - 100);
      const contextEnd = Math.min(
        content.length,
        achievementIndex + achievement.length + 100
      );
      const context = content.slice(contextStart, contextEnd);

      for (const participant of participants) {
        if (context.toLowerCase().includes(participant.name.toLowerCase())) {
          contributors.push(participant.name);
        }
      }
    }

    return contributors.length > 0 ? contributors : ['Team effort'];
  }

  private assessAchievementImpact(achievement: string): string {
    const impactKeywords = {
      high: ['major', 'significant', 'breakthrough', 'critical'],
      medium: ['important', 'notable', 'good'],
      low: ['small', 'minor', 'incremental'],
    };

    const lowerAchievement = achievement.toLowerCase();

    for (const [impact, keywords] of Object.entries(impactKeywords)) {
      if (keywords.some((keyword) => lowerAchievement.includes(keyword))) {
        return `${impact} impact on project progress`;
      }
    }

    return 'Positive contribution to project goals';
  }

  private async extractChallenges(
    content: string,
    participants: Participant[]
  ): Promise<any[]> {
    const challenges: any[] = [];

    const challengePatterns = [
      /(?:challenge|difficulty|obstacle)[:\s]*([^.!?]+)/gi,
      /(?:struggling|difficult)\s+(?:with\s+|to\s+)?([^.!?]+)/gi,
      /(?:blocker|impediment)[:\s]*([^.!?]+)/gi,
    ];

    for (const pattern of challengePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const challenge = match[1]?.trim();
        if (challenge && challenge.length > 10) {
          challenges.push({
            challenge,
            impact: this.assessChallengeImpact(challenge),
            proposedSolutions: this.extractProposedSolutions(
              challenge,
              content
            ),
            owner: this.extractChallengeOwner(challenge, content, participants),
          });
        }
      }
    }

    return challenges;
  }

  private assessChallengeImpact(challenge: string): string {
    return this.assessConcernImpact(challenge); // Same logic as concerns
  }

  private extractChallengeOwner(
    challenge: string,
    content: string,
    participants: Participant[]
  ): string {
    return this.inferSpeaker(
      content.toLowerCase().indexOf(challenge.toLowerCase()),
      content,
      participants
    );
  }

  async analyzeParticipantContributions(
    discussionContent: string,
    participants: Participant[]
  ): Promise<any> {
    const insights = {
      participationLevels: this.analyzeParticipationLevels(
        discussionContent,
        participants
      ),
      contributionTypes: this.analyzeContributionTypes(
        discussionContent,
        participants
      ),
      expertiseShown: this.analyzeExpertiseShown(
        discussionContent,
        participants
      ),
      engagementMetrics: this.calculateEngagementMetrics(
        discussionContent,
        participants
      ),
    };

    return insights;
  }

  private analyzeParticipationLevels(
    content: string,
    participants: Participant[]
  ): { participant: string; level: string }[] {
    return participants.map((participant) => {
      const mentions = this.countMentions(participant.name, content);
      const level = mentions > 5 ? 'high' : mentions > 2 ? 'medium' : 'low';

      return {
        participant: participant.name,
        level: level,
      };
    });
  }

  private countMentions(name: string, content: string): number {
    const regex = new RegExp(name, 'gi');
    return (content.match(regex) || []).length;
  }

  private analyzeContributionTypes(
    content: string,
    participants: Participant[]
  ): { participant: string; types: string[] }[] {
    const contributionTypes = [
      'questions',
      'suggestions',
      'concerns',
      'decisions',
      'information',
    ];

    return participants.map((participant) => {
      const contributions: { [key: string]: number } = {};

      for (const type of contributionTypes) {
        contributions[type] = this.countContributionType(
          participant.name,
          type,
          content
        );
      }

      return {
        participant: participant.name,
        types: Object.keys(contributions).filter(
          (key) => contributions[key] > 0
        ),
      };
    });
  }

  private countContributionType(
    name: string,
    type: string,
    content: string
  ): number {
    const patterns: { [key: string]: string[] } = {
      questions: ['\\?', 'how', 'what', 'why', 'when', 'where'],
      suggestions: ['suggest', 'recommend', 'propose', 'think we should'],
      concerns: ['concern', 'worry', 'issue', 'problem'],
      decisions: ['decide', 'agree', 'choose', 'go with'],
      information: ['according to', 'data shows', 'research indicates'],
    };

    let count = 0;
    const typePatterns = patterns[type] || [];

    for (const pattern of typePatterns) {
      const regex = new RegExp(`${name}.*${pattern}|${pattern}.*${name}`, 'gi');
      count += (content.match(regex) || []).length;
    }

    return count;
  }

  private analyzeExpertiseShown(
    content: string,
    participants: Participant[]
  ): { participant: string; expertise: string[] }[] {
    return participants.map((participant) => {
      const expertise = this.identifyExpertiseAreas(participant.name, content);

      return {
        participant: participant.name,
        expertise: expertise,
      };
    });
  }

  private identifyExpertiseAreas(name: string, content: string): string[] {
    const expertiseKeywords = {
      technical: [
        'code',
        'architecture',
        'system',
        'implementation',
        'technical',
      ],
      business: ['business', 'strategy', 'market', 'customer', 'revenue'],
      design: ['design', 'user', 'interface', 'experience', 'visual'],
      process: ['process', 'workflow', 'methodology', 'agile', 'scrum'],
      data: ['data', 'analytics', 'metrics', 'reporting', 'database'],
    };

    const expertise: string[] = [];
    const nameIndex = content.toLowerCase().indexOf(name.toLowerCase());

    if (nameIndex !== -1) {
      const context = content
        .slice(
          Math.max(0, nameIndex - 200),
          Math.min(content.length, nameIndex + 200)
        )
        .toLowerCase();

      for (const [area, keywords] of Object.entries(expertiseKeywords)) {
        if (keywords.some((keyword) => context.includes(keyword))) {
          expertise.push(area);
        }
      }
    }

    return expertise;
  }

  private calculateEngagementMetrics(
    content: string,
    participants: Participant[]
  ): { speakingTime: number; contributions: number; questions: number } {
    const totalMentions = participants.reduce(
      (sum, p) => sum + this.countMentions(p.name, content),
      0
    );

    const averageParticipation = totalMentions / participants.length;

    const highParticipants = participants.filter(
      (p) => this.countMentions(p.name, content) > averageParticipation
    ).length;

    return {
      speakingTime: averageParticipation,
      contributions: highParticipants,
      questions: 0, // Could be enhanced to count actual questions
    };
  }

  async analyzeMeetingSeries(seriesId: string): Promise<MeetingSeries> {
    // This would typically fetch data from a meeting history database
    // For now, return a mock analysis
    return {
      seriesId,
      name: 'Weekly Team Sync',
      purpose: 'Team coordination and progress updates',
      frequency: 'Weekly',
      participants: ['Team Lead', 'Developer 1', 'Developer 2', 'Designer'],
      recurringTopics: ['Sprint progress', 'Blockers', 'Upcoming deadlines'],
      previousMeetings: [
        {
          date: '2024-01-08',
          keyOutcomes: ['Sprint planning completed', 'Blockers identified'],
          actionItemsCompleted: 8,
          attendanceRate: 95,
        },
      ],
      trends: [
        {
          metric: 'Action Item Completion',
          trend: 'improving',
          description: 'Team has improved action item completion rate by 15%',
        },
      ],
      effectiveness: {
        actionItemCompletionRate: 85,
        decisionImplementationRate: 90,
        participantSatisfaction: 4.2,
        timeUtilization: 88,
      },
    };
  }

  // Helper methods for default values and formatting
  private getDefaultOptions(): MeetingSummaryOptions {
    return {
      includeActionItems: true,
      includeDecisionTracking: true,
      includeFollowUpTasks: true,
      includeParticipantTracking: true,
      includeMeetingNotes: true,
      includeSeriesTracking: false,
      meetingType: 'general',
      outputFormat: 'markdown',
    };
  }

  private getDefaultTemplateName(meetingType: string): string {
    const templateMap: { [key: string]: string } = {
      standup: 'meeting-summary-standup',
      planning: 'meeting-summary-planning',
      retrospective: 'meeting-summary-retrospective',
      review: 'meeting-summary-review',
      general: 'meeting-summary-default',
    };

    return templateMap[meetingType] || 'meeting-summary-default';
  }

  // Formatting methods
  private generateMeetingHeader(context: MeetingContext): string {
    return `# ${context.title}

**Date:** ${context.date}
**Duration:** ${context.duration}
**Type:** ${context.meetingType}
**Participants:** ${context.participants.length} attendees

## Agenda
${context.agenda.map((item) => `- ${item}`).join('\n')}

## Objectives
${context.objectives.map((obj) => `- ${obj}`).join('\n')}`;
  }

  private generateParticipantSummary(participants: Participant[]): string {
    const participantList = participants
      .map((p) => `- **${p.name}** (${p.role}) - ${p.attendance}`)
      .join('\n');

    return `## Participants

${participantList}

**Attendance Rate:** ${((participants.filter((p) => p.attendance === 'present').length / participants.length) * 100).toFixed(1)}%`;
  }

  private formatMeetingNotes(notes: MeetingNotes): string {
    const topicsSection = notes.keyTopics
      .map(
        (topic) =>
          `### ${topic.topic}
${topic.discussion}

**Outcomes:** ${topic.outcomes.join(', ') || 'None specified'}
**Next Steps:** ${topic.nextSteps.join(', ') || 'None specified'}`
      )
      .join('\n\n');

    const quotesSection = notes.importantQuotes
      .map(
        (quote) =>
          `> "${quote.quote}" - **${quote.speaker}**\n*${quote.significance}*`
      )
      .join('\n\n');

    const concernsSection = notes.concerns
      .map(
        (concern) =>
          `- **${concern.concern}** (Raised by: ${concern.raisedBy})\n  Impact: ${concern.impact}`
      )
      .join('\n');

    return `## Meeting Notes

### Key Discussion Topics
${topicsSection}

### Important Quotes
${quotesSection}

### Concerns Raised
${concernsSection}

### Achievements Highlighted
${notes.achievements.map((a) => `- ${a.achievement} (Contributors: ${a.contributors.join(', ')})`).join('\n')}

### Challenges Discussed
${notes.challenges.map((c) => `- ${c.challenge} (Owner: ${c.owner})`).join('\n')}`;
  }

  private formatActionItems(actionItems: ActionItem[]): string {
    if (actionItems.length === 0) {
      return '## Action Items\n\nNo action items were identified.';
    }

    const items = actionItems
      .map(
        (item) =>
          `### ${item.id}: ${item.description}
- **Assignee:** ${item.assignee}
- **Due Date:** ${item.dueDate}
- **Priority:** ${item.priority}
- **Category:** ${item.category}
- **Estimated Effort:** ${item.estimatedEffort}
- **Status:** ${item.status}
${item.dependencies.length > 0 ? `- **Dependencies:** ${item.dependencies.join(', ')}` : ''}`
      )
      .join('\n\n');

    const summary = `
**Summary:**
- Total Action Items: ${actionItems.length}
- High Priority: ${actionItems.filter((i) => i.priority === 'high').length}
- Medium Priority: ${actionItems.filter((i) => i.priority === 'medium').length}
- Low Priority: ${actionItems.filter((i) => i.priority === 'low').length}`;

    return `## Action Items

${summary}

${items}`;
  }

  private formatDecisions(decisions: Decision[]): string {
    if (decisions.length === 0) {
      return '## Decisions\n\nNo formal decisions were recorded.';
    }

    const items = decisions
      .map(
        (decision) =>
          `### ${decision.id}: ${decision.title}
**Description:** ${decision.description}

**Rationale:** ${decision.rationale}

**Impact:** ${decision.impact}

**Stakeholders:** ${decision.stakeholders.join(', ')}

**Status:** ${decision.status}

${
  decision.alternatives.length > 0
    ? `**Alternatives Considered:**
${decision.alternatives.map((alt) => `- ${alt.option} (${alt.rejected ? 'Rejected' : 'Considered'})`).join('\n')}`
    : ''
}

${decision.risks.length > 0 ? `**Risks:** ${decision.risks.join(', ')}` : ''}`
      )
      .join('\n\n');

    return `## Decisions

${items}`;
  }

  private formatFollowUpTasks(tasks: FollowUpTask[]): string {
    if (tasks.length === 0) {
      return '## Follow-Up Tasks\n\nNo follow-up tasks were identified.';
    }

    const items = tasks
      .map(
        (task) =>
          `### ${task.id}: ${task.description}
- **Type:** ${task.type}
- **Assignee:** ${task.assignee}
- **Requester:** ${task.requester}
- **Due Date:** ${task.dueDate}
- **Priority:** ${task.priority}
- **Deliverable:** ${task.deliverable}
- **Success Criteria:** ${task.successCriteria.join(', ')}`
      )
      .join('\n\n');

    return `## Follow-Up Tasks

${items}`;
  }

  private formatParticipantInsights(insights: any): string {
    const participationSection = insights.participationLevels
      .map(
        (p: any) =>
          `- **${p.name}** (${p.role}): ${p.participationLevel} participation (${p.mentionsCount} contributions)`
      )
      .join('\n');

    const engagementSection = `
**Overall Engagement:**
- Active Participants: ${insights.engagementMetrics.activeParticipants}/${insights.engagementMetrics.totalParticipants}
- Participation Rate: ${insights.engagementMetrics.participationRate.toFixed(1)}%
- Average Contributions: ${insights.engagementMetrics.averageMentionsPerParticipant.toFixed(1)}`;

    return `## Participant Analysis

### Participation Levels
${participationSection}

${engagementSection}`;
  }

  private formatSeriesAnalysis(series: MeetingSeries): string {
    const trendsSection = series.trends
      .map(
        (trend) =>
          `- **${trend.metric}:** ${trend.trend} - ${trend.description}`
      )
      .join('\n');

    const effectivenessSection = `
- Action Item Completion Rate: ${series.effectiveness.actionItemCompletionRate}%
- Decision Implementation Rate: ${series.effectiveness.decisionImplementationRate}%
- Participant Satisfaction: ${series.effectiveness.participantSatisfaction}/5.0
- Time Utilization: ${series.effectiveness.timeUtilization}%`;

    return `## Meeting Series Analysis

**Series:** ${series.name}
**Purpose:** ${series.purpose}
**Frequency:** ${series.frequency}

### Trends
${trendsSection}

### Effectiveness Metrics
${effectivenessSection}

### Recurring Topics
${series.recurringTopics.map((topic) => `- ${topic}`).join('\n')}`;
  }
}
