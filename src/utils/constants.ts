

export const PROJECT_DASHBOARD_VIEW_TYPE = "project-dashboard";
export const PROJECT_SINGLE_VIEW_TYPE = "project-single";
export const TODO_DASHBOARD_VIEW_TYPE = "todo-dashboard";
export const ISSUE_DASHBOARD_VIEW_TYPE = "issue-dashboard";
export const TIME_DASHBOARD_VIEW_TYPE = "time-dashboard";
export const VIEW_TYPE_TRACKER = "project-tracker"

export const GREEN_BALL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="8" fill="#159447"/>
    <circle cx="8" cy="7.5" r="5.5" fill="#43d85a" opacity="0.75"/>
    <circle cx="6.5" cy="5.5" r="2.5" fill="#9aff9a" opacity="0.55"/>
</svg>
`;

export const GREEN_BALL_2 = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    aria-hidden="true"
>
    <defs>
        <radialGradient id="green-ball-gradient"
                        cx="30%"
                        cy="25%"
                        r="75%">
            <stop offset="0%" stop-color="#8cff8c"/>
            <stop offset="45%" stop-color="#43d85a"/>
            <stop offset="100%" stop-color="#159447"/>
        </radialGradient>
    </defs>

    <circle
        cx="10"
        cy="10"
        r="8"
        fill="url(#green-ball-gradient)"
    />
</svg>
`

export const WHITE_BALL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="8" fill="#fefefe"/>
    <circle cx="8" cy="7.5" r="5.5" fill="#fafafa" opacity="0.75"/>
    <circle cx="6.5" cy="5.5" r="2.5" fill="#9a9a9a" opacity="0.55"/>
</svg>
`;
