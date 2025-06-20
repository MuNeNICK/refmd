/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DiffLine = {
    /**
     * Type of change for this line
     */
    line_type?: DiffLine.line_type;
    /**
     * Line number in the original file
     */
    old_line_number?: number | null;
    /**
     * Line number in the new file
     */
    new_line_number?: number | null;
    /**
     * The actual line content
     */
    content?: string;
};
export namespace DiffLine {
    /**
     * Type of change for this line
     */
    export enum line_type {
        ADDED = 'added',
        DELETED = 'deleted',
        CONTEXT = 'context',
    }
}

