import { ScheduleXEvent } from "../../types/events";

interface EventModalProps {
    event: ScheduleXEvent | null;
    onClose: () => void;
}
export default function EventModal({ event, onClose }: EventModalProps) {
    if (!event) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    };

    // Format date and time from Temporal.ZoneDataTime
    const formatDate = (dt: Temporal.ZonedDateTime) => {
        return dt.toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    };
    const formatTime = (start: Temporal.ZonedDateTime, end: Temporal.ZonedDateTime) => {
        const startTime = start.toLocaleString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,

        });
          const endTime = end.toLocaleString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });
        return `${startTime} - ${endTime}`
    }
    return ("hola")
}
