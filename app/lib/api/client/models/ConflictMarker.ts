/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ConflictMarker = {
    /**
     * Line number where conflict starts
     */
    start_line?: number;
    /**
     * Line number of the separator
     */
    middle_line?: number;
    /**
     * Line number where conflict ends
     */
    end_line?: number;
    /**
     * Our version content lines
     */
    our_content?: Array<string>;
    /**
     * Their version content lines
     */
    their_content?: Array<string>;
};

