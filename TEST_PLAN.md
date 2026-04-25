# Overleaf MCP Server Test Plan

## Overview
This document outlines the comprehensive testing approach for the Overleaf MCP server to ensure all functionality works correctly.

## Test Environment Setup

### Prerequisites
1. Node.js 18+ installed
2. Chrome/Chromium browser for Puppeteer
3. Test Overleaf account (free tier is sufficient)
4. Git installed (for Git integration tests)

### Setup Steps
1. Clone repository and install dependencies
2. Create `.env` file from `.env.example`
3. Run `npm run smart-auth` to authenticate
4. Create test projects in Overleaf with varied content

## Test Plan

### Phase 1: Authentication Testing (HIGH PRIORITY)

#### 1.1 Smart Authentication
- [ ] Run `npm run smart-auth` with fresh session
- [ ] Verify cookie extraction works
- [ ] Test authentication persistence after server restart
- [ ] Test expired cookie handling

#### 1.2 Manual Authentication
- [ ] Test manual cookie injection
- [ ] Test invalid cookie scenarios
- [ ] Test multiple account switching

### Phase 2: Server Startup and Basic Functionality

#### 2.1 Server Initialization
- [ ] Start server in dev mode (`npm run dev`)
- [ ] Verify all 19 tools are registered
- [ ] Verify all 7 prompts are registered
- [ ] Verify all 6 resources are registered
- [ ] Test server graceful shutdown

#### 2.2 MCP Connection
- [ ] Test MCP client connection
- [ ] Verify tool listing
- [ ] Verify prompt listing
- [ ] Verify resource listing

### Phase 3: Core Workflow Testing (HIGHEST PRIORITY)

#### 3.1 Download Functionality
- [ ] Download simple single-file project
- [ ] Download complex multi-file project with images
- [ ] Download project with nested folders
- [ ] Download project with special characters in filenames
- [ ] Test download with invalid project ID
- [ ] Test download without authentication

#### 3.2 Local Project Management
- [ ] Verify downloaded project structure is preserved
- [ ] Test project listing functionality
- [ ] Test project deletion
- [ ] Test project metadata handling

#### 3.3 Upload Functionality
- [ ] Upload new file to existing project
- [ ] Update existing file
- [ ] Upload file with special characters
- [ ] Upload large file (>1MB)
- [ ] Test upload without authentication
- [ ] Test upload to invalid project ID

#### 3.4 End-to-End Workflow
1. Download project from Overleaf
2. Modify a .tex file locally
3. Upload modified file back to Overleaf
4. Verify changes appear in Overleaf editor
5. Test compilation in Overleaf

### Phase 4: Additional Tools Testing

#### 4.1 Project Management Tools
- [ ] Create new project (`latex_create_project`)
- [ ] List projects (`latex_list_projects`)
- [ ] Delete project (`latex_delete_project`)

#### 4.2 Compilation Tools
- [ ] Compile LaTeX document (`latex_compile`)
- [ ] Analyze compilation log (`latex_analyze_log`)
- [ ] Test with different engines (pdflatex, xelatex, lualatex)

#### 4.3 Git Integration Tools
- [ ] Clone project via Git (`latex_clone_from_overleaf`)
- [ ] Pull changes (`latex_pull_from_overleaf`)
- [ ] Push changes (`latex_push_to_overleaf`)

#### 4.4 Utility Tools
- [ ] Search within files (`latex_search_in_files`)
- [ ] Validate LaTeX syntax (`latex_validate_syntax`)
- [ ] Extract bibliography (`latex_extract_bibliography`)

### Phase 5: Error Handling and Edge Cases

#### 5.1 Network Issues
- [ ] Test behavior with network interruption
- [ ] Test timeout scenarios
- [ ] Test rate limiting

#### 5.2 File System Issues
- [ ] Test with insufficient disk space
- [ ] Test with permission denied errors
- [ ] Test with invalid file paths

#### 5.3 Browser Automation Issues
- [ ] Test when Chrome is not installed
- [ ] Test browser crash scenarios
- [ ] Test headless mode limitations

### Phase 6: Performance Testing

#### 6.1 Large Projects
- [ ] Download project with 100+ files
- [ ] Upload large binary files
- [ ] Test memory usage during operations

#### 6.2 Concurrent Operations
- [ ] Test multiple simultaneous downloads
- [ ] Test concurrent uploads to different projects
- [ ] Test server under load

### Phase 7: Security Testing

#### 7.1 Authentication Security
- [ ] Verify cookie storage is secure
- [ ] Test session expiration
- [ ] Test cross-site request forgery protection

#### 7.2 Input Validation
- [ ] Test malicious file names
- [ ] Test LaTeX injection attempts
- [ ] Test oversized inputs

## Test Data

### Sample Projects
1. **Simple Article**: Single .tex file with basic structure
2. **Complex Thesis**: Multiple chapters, bibliography, images
3. **Beamer Presentation**: .tex with images and custom themes
4. **Unicode Project**: Non-ASCII characters and special encoding
5. **Nested Structure**: Deep folder hierarchy with mixed file types

### Test Accounts
- Free tier account (limited features)
- Premium account (full features)
- Expired session cookies

## Success Criteria

1. All authentication methods work reliably
2. Core download→edit→upload workflow succeeds
3. All 19 tools function without errors
4. Error handling is graceful and informative
5. Performance is acceptable for typical use cases
6. No security vulnerabilities are exposed

## Automation Opportunities

1. Unit tests for utility functions
2. Integration tests for API clients
3. E2E tests using Puppeteer for browser automation
4. Mock Overleaf API for isolated testing

## Reporting

Test results will be documented with:
- Pass/fail status for each test
- Screenshots of browser automation steps
- Error logs and stack traces
- Performance metrics
- Identified issues and recommendations
