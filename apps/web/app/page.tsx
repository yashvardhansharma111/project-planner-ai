import { GuestChat } from '@/components/guest-chat';

/**
 * Landing page = the guest chatbot. Visitors can scope a project without an
 * account; GuestChat redirects signed-in users to their role's home and shows a
 * sign-in wall at the generate step.
 */
export default function HomePage() {
  return <GuestChat />;
}
