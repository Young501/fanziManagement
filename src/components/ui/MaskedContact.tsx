'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface MaskedContactProps {
    contact: string;
    className?: string;
    iconClassName?: string;
}

export function MaskedContact({ contact, className = '', iconClassName = 'w-3.5 h-3.5' }: MaskedContactProps) {
    const [isRevealed, setIsRevealed] = useState(false);

    if (!contact) {
        return <span className={className}>-</span>;
    }

    // Mask valid phone numbers (11 digits starting with 13-19)
    // Format: 138****5678
    const maskPhoneNumber = (text: string) => {
        return text.replace(/(1[3-9]\d)\d{4}(\d{4})/g, '$1****$2');
    };

    const hasMaskableContent = /(1[3-9]\d)\d{4}(\d{4})/.test(contact);

    if (!hasMaskableContent) {
        return <span className={className}>{contact}</span>;
    }

    const displayText = isRevealed ? contact : maskPhoneNumber(contact);

    return (
        <span
            className={`inline-flex items-center gap-1 cursor-pointer transition-colors hover:text-blue-600 ${className} ${isRevealed ? 'text-blue-600' : ''}`}
            onClick={(e) => {
                e.stopPropagation();
                setIsRevealed(!isRevealed);
            }}
            title={isRevealed ? "点击隐藏" : "点击显示完整号码"}
        >
            {displayText}
            {isRevealed ? (
                <EyeOff className={`text-slate-400 hover:text-blue-500 ${iconClassName}`} />
            ) : (
                <Eye className={`text-slate-400 hover:text-blue-500 ${iconClassName}`} />
            )}
        </span>
    );
}
