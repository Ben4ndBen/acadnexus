import { StatusBadge } from '@/components/StatusBadge';

export default function TrackerPage() {
    return (
        <div>
            <h2>Exam Request Status</h2>
            {/* Example of how it looks in your UI */}
            <StatusBadge status="Pending Chair" />
        </div>
    );
}