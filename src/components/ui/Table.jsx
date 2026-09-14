import React from 'react';

export const Table = ({
  headers = [],
  children,
  className = ''
}) => {
  return (
    <div className={`w-full overflow-x-auto rounded-lg ${className}`}>
      <table className="w-full text-left text-sm border-collapse">
        {headers.length > 0 && (
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/12 text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
              {headers.map((h, idx) => (
                <th key={idx} className="py-3.5 px-4 first:pl-4 last:pr-4 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.08] text-slate-800 dark:text-slate-100">
          {children}
        </tbody>
      </table>
    </div>
  );
};

export const TableRow = ({
  children,
  onClick,
  className = '',
  ...props
}) => {
  return (
    <tr
      onClick={onClick}
      className={`group hover:bg-slate-50/80 dark:hover:bg-white/[0.06] transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
};

export const TableCell = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <td className={`py-4 px-4 first:pl-4 last:pr-4 ${className}`} {...props}>
      {children}
    </td>
  );
};
