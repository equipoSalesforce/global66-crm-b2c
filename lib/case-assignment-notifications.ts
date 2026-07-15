export type CaseAssignmentNotification = {
  id: string;
  caseId: string;
  caseNumber: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
};

export type CaseAssignmentNotificationsResponse = {
  unreadCount: number;
  notifications: CaseAssignmentNotification[];
};

