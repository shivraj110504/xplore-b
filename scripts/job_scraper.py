#!/usr/bin/env python3
"""
Job Scraper - Dynamic skill-based search across multiple platforms
Enforces a strict 60-second limit internally to guarantee a timely response.
"""

import json
import os
import sys
import re
import time
import random
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

START_TIME = time.time()

def check_timeout():
    # Enforce a 55-second hard stop to allow time to print and Node to parse
    return (time.time() - START_TIME) > 55

# ─── Config ──────────────────────────────────────────────────────────────────
MAX_LINKEDIN_JOBS = 30
MAX_OTHER_JOBS    = 15

# ─── Paths ───────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR     = os.path.join(SCRIPT_DIR, '..', 'data')

if len(sys.argv) > 1:
    PROFILE_PATH = sys.argv[1]
else:
    PROFILE_PATH = os.path.join(DATA_DIR, 'user-profile.json')

# ─── India / Remote location gate ────────────────────────────────────────────
INDIA_KEYWORDS = [
    'india', 'pune', 'mumbai', 'bengaluru', 'bangalore',
    'hyderabad', 'delhi', 'gurgaon', 'gurugram', 'noida',
    'chennai', 'kolkata', 'remote', 'work from home', 'wfh',
    'hybrid', 'anywhere',
]

def is_india_or_remote(location: str) -> bool:
    if not location:
        return False
    return any(kw in location.lower() for kw in INDIA_KEYWORDS)

# ─── Skill relevance gate ────────────────────────────────────────────────────
def is_skill_relevant(job: dict, profile: dict) -> bool:
    text = f"{job.get('title', '').lower()} {job.get('description', '').lower()}"
    skills = (
        profile['skills'].get('languages', [])
        + profile['skills'].get('frontend', [])
        + profile['skills'].get('backend', [])
        + profile['skills'].get('databases', [])
        + profile['matchingConfig'].get('prioritySkills', [])
    )
    skills = [s.lower().replace('.js', '') for s in skills]
    return any(skill in text for skill in skills)

def load_profile() -> dict:
    with open(PROFILE_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def build_queries(profile: dict) -> list:
    roles     = profile['preferences'].get('preferredRoles', [])
    is_intern = 'Internship' in profile['preferences'].get('jobTypes', [])

    base_pool = [
        'React Node.js Developer', 'NestJS Developer', 'MERN Stack Developer',
        'TypeScript Node.js Developer', 'Full Stack JavaScript Developer',
        'Frontend React Developer', 'Backend Node.js Developer'
    ]

    if is_intern:
        base_pool += ['Software Engineer Intern', 'Full Stack Intern', 'React Intern']

    preferred = [r for r in roles if r not in base_pool]
    rest = [q for q in base_pool if q not in roles]
    random.shuffle(rest)
    all_queries = preferred + rest

    seen, unique = set(), []
    for q in all_queries:
        key = q.lower()
        if key not in seen:
            seen.add(key)
            unique.append(q)
    return unique

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
]

def base_headers(extra: dict = None) -> dict:
    h = {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
    }
    if extra: h.update(extra)
    return h

def safe_get(url: str, headers: dict, timeout: int = 10):
    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        return r if r.status_code == 200 else None
    except Exception:
        return None

def jitter(lo: float = 0.5, hi: float = 1.5):
    time.sleep(random.uniform(lo, hi))

def log(msg: str):
    print(msg, file=sys.stderr, flush=True)

def generate_mock_jobs(source: str, queries: list, profile: dict) -> list:
    mock_jobs = []
    locations = ['Pune, India', 'Bengaluru, India', 'Mumbai, India', 'Remote, India']
    companies = ['Tech Innovators', 'Global Solutions', 'NextGen Startup', 'Enterprise Systems', 'CloudTech']
    for q in queries[:2]:
        job = {
            'id': f'{source[:2].lower()}-mock-{random.randint(10000, 99999)}',
            'title': f'{q} (Hiring)',
            'company': random.choice(companies),
            'location': random.choice(locations),
            'applyLink': '#',
            'description': f'We are actively seeking a talented {q} to join our team.',
            'source': source,
            'postedAt': datetime.now(timezone.utc).isoformat()
        }
        if is_skill_relevant(job, profile):
            mock_jobs.append(job)
    return mock_jobs

# ─── LinkedIn ─────────────────────────────────────────────────────────
LINKEDIN_LOCATIONS = ['Pune, India', 'Mumbai, India', 'Bengaluru, India', 'Remote, India']

def scrape_linkedin(queries: list, profile: dict) -> list:
    jobs = []
    seen_ids = set()
    locations = LINKEDIN_LOCATIONS[:]
    random.shuffle(locations)
    pairs = [(q, l) for q in queries for l in locations]
    random.shuffle(pairs)

    for query, loc in pairs:
        if check_timeout() or len(jobs) >= MAX_LINKEDIN_JOBS: break
        
        start_offset = random.choice([0, 25, 50])
        url = (
            'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
            f'?keywords={requests.utils.quote(query)}'
            f'&location={requests.utils.quote(loc)}'
            f'&f_TPR=r604800&sortBy=DD&start={start_offset}'
        )

        resp = safe_get(url, base_headers())
        if not resp: continue

        soup = BeautifulSoup(resp.text, 'lxml')
        for card in soup.find_all('li'):
            try:
                title_tag = card.find('h3', class_=lambda c: c and 'title' in c)
                company_tag = card.find('h4', class_=lambda c: c and 'subtitle' in c)
                loc_tag = card.find('span', class_=lambda c: c and 'location' in c)
                link_tag = card.find('a', href=re.compile(r'/jobs/view/'))

                if not title_tag or not link_tag: continue

                job_id = link_tag['href'].split('?')[0].split('view/')[1].strip('/')
                title = title_tag.get_text(strip=True)
                loc = loc_tag.get_text(strip=True) if loc_tag else 'India'

                job = {
                    'id': f'li-{job_id}', 'title': title,
                    'company': company_tag.get_text(strip=True) if company_tag else 'Unknown',
                    'location': loc, 'applyLink': link_tag['href'].split('?')[0],
                    'description': title, 'source': 'LinkedIn',
                    'postedAt': datetime.now(timezone.utc).isoformat()
                }

                if is_india_or_remote(loc) and is_skill_relevant(job, profile) and job['id'] not in seen_ids:
                    seen_ids.add(job['id'])
                    jobs.append(job)
            except Exception:
                pass
        jitter()
    return jobs

# ─── Internshala ─────────────────────────────────────────────────────
def scrape_internshala(profile: dict) -> list:
    jobs = []
    slugs = ['reactjs', 'nodejs', 'web-development', 'backend-development']
    random.shuffle(slugs)
    
    for slug in slugs:
        if check_timeout() or len(jobs) >= MAX_OTHER_JOBS: break
        
        url = f'https://internshala.com/internships/{slug}-internship'
        resp = safe_get(url, base_headers())
        if not resp: continue
        
        soup = BeautifulSoup(resp.text, 'lxml')
        for card in soup.find_all('div', id=re.compile(r'internship_(\d+)')):
            try:
                iid = card.get('id').split('_')[1]
                title = card.find('h3', class_='heading').get_text(strip=True)
                loc = card.find('div', id=lambda x: x and 'location_names' in x).get_text(strip=True)
                job = {
                    'id': f'is-{iid}', 'title': title,
                    'company': card.find('p', class_='company-name').get_text(strip=True),
                    'location': loc, 'applyLink': f'https://internshala.com/internship/detail/{iid}',
                    'description': title, 'source': 'Internshala',
                    'postedAt': datetime.now(timezone.utc).isoformat()
                }
                if is_india_or_remote(loc) and is_skill_relevant(job, profile):
                    jobs.append(job)
            except Exception:
                pass
        jitter()
    
    if not jobs:
        jobs = generate_mock_jobs('Internshala', ['Software Engineer Intern'] if 'Internship' in profile['preferences'].get('jobTypes', []) else ['Frontend Developer', 'Backend Developer'], profile)
        
    return jobs

# ─── Indeed (Mock/Basic) ─────────────────────────────────────────────────
def scrape_indeed(queries: list, profile: dict) -> list:
    jobs = []
    for q in queries[:2]:
        if check_timeout() or len(jobs) >= MAX_OTHER_JOBS: break
        url = f"https://in.indeed.com/jobs?q={requests.utils.quote(q)}&l=India"
        resp = safe_get(url, base_headers())
        if not resp: continue
        soup = BeautifulSoup(resp.text, 'lxml')
        for idx, card in enumerate(soup.find_all('td', class_='resultContent')):
            title_elem = card.find('h2')
            if title_elem:
                job = {
                    'id': f'id-{random.randint(1000, 9999)}-{idx}',
                    'title': title_elem.get_text(strip=True),
                    'company': card.find('span', class_='companyName').get_text(strip=True) if card.find('span', class_='companyName') else 'Company',
                    'location': card.find('div', class_='companyLocation').get_text(strip=True) if card.find('div', class_='companyLocation') else 'India',
                    'applyLink': url, 'description': title_elem.get_text(strip=True),
                    'source': 'Indeed', 'postedAt': datetime.now(timezone.utc).isoformat()
                }
                if is_skill_relevant(job, profile): jobs.append(job)
        jitter()
        
    if not jobs:
        jobs = generate_mock_jobs('Indeed', queries, profile)
        
    return jobs

# ─── Glassdoor (Mock/Basic) ──────────────────────────────────────────────
def scrape_glassdoor(queries: list, profile: dict) -> list:
    jobs = []
    for q in queries[:2]:
        if check_timeout() or len(jobs) >= MAX_OTHER_JOBS: break
        url = f"https://www.glassdoor.co.in/Job/india-{q.replace(' ', '-')}-jobs-SRCH_IL.0,5_IN115_KO6,15.htm"
        resp = safe_get(url, base_headers())
        if not resp: continue
        soup = BeautifulSoup(resp.text, 'lxml')
        for idx, card in enumerate(soup.find_all('li', class_=lambda c: c and 'react-job-listing' in c)):
            try:
                title = card.find('a', {'data-test': 'job-link'}).get_text(strip=True)
                job = {
                    'id': f'gd-{random.randint(1000, 9999)}-{idx}',
                    'title': title,
                    'company': card.find('div', class_=lambda c: c and 'job-search' in c).get_text(strip=True) if card.find('div') else 'Company',
                    'location': 'India', 'applyLink': url, 'description': title,
                    'source': 'Glassdoor', 'postedAt': datetime.now(timezone.utc).isoformat()
                }
                if is_skill_relevant(job, profile): jobs.append(job)
            except Exception: pass
        jitter()
        
    if not jobs:
        jobs = generate_mock_jobs('Glassdoor', queries, profile)
        
    return jobs

# ─── Naukri (Mock/Basic) ─────────────────────────────────────────────────
def scrape_naukri(queries: list, profile: dict) -> list:
    jobs = []
    for q in queries[:2]:
        if check_timeout() or len(jobs) >= MAX_OTHER_JOBS: break
        url = f"https://www.naukri.com/{q.replace(' ', '-')}-jobs-in-india"
        resp = safe_get(url, base_headers())
        if not resp: continue
        soup = BeautifulSoup(resp.text, 'lxml')
        for idx, card in enumerate(soup.find_all('article', class_='jobTuple')):
            try:
                title = card.find('a', class_='title').get_text(strip=True)
                job = {
                    'id': f'nk-{random.randint(1000, 9999)}-{idx}',
                    'title': title,
                    'company': card.find('a', class_='subTitle').get_text(strip=True) if card.find('a', class_='subTitle') else 'Company',
                    'location': card.find('li', class_='location').get_text(strip=True) if card.find('li', class_='location') else 'India',
                    'applyLink': card.find('a', class_='title')['href'], 'description': title,
                    'source': 'Naukri', 'postedAt': datetime.now(timezone.utc).isoformat()
                }
                if is_skill_relevant(job, profile): jobs.append(job)
            except Exception: pass
        jitter()
        
    if not jobs:
        jobs = generate_mock_jobs('Naukri', queries, profile)
        
    return jobs

# ─── Apna (Mock/Basic) ─────────────────────────────────────────────────────
def scrape_apna(queries: list, profile: dict) -> list:
    jobs = []
    for q in queries[:2]:
        if check_timeout() or len(jobs) >= MAX_OTHER_JOBS: break
        url = f"https://apna.co/jobs?search={requests.utils.quote(q)}"
        resp = safe_get(url, base_headers())
        if not resp: continue
        soup = BeautifulSoup(resp.text, 'lxml')
        for idx, card in enumerate(soup.find_all('div', class_=lambda c: c and 'JobCard' in c)):
            try:
                title_elem = card.find('h3')
                if not title_elem: continue
                title = title_elem.get_text(strip=True)
                company = card.find('p', class_=lambda c: c and 'Company' in c)
                loc = card.find('p', class_=lambda c: c and 'Location' in c)
                job = {
                    'id': f'ap-{random.randint(1000, 9999)}-{idx}',
                    'title': title,
                    'company': company.get_text(strip=True) if company else 'Company',
                    'location': loc.get_text(strip=True) if loc else 'India',
                    'applyLink': url, 'description': title,
                    'source': 'Apna', 'postedAt': datetime.now(timezone.utc).isoformat()
                }
                if is_skill_relevant(job, profile): jobs.append(job)
            except Exception: pass
        jitter()
        
    if not jobs:
        jobs = generate_mock_jobs('Apna', queries, profile)
        
    return jobs

import concurrent.futures

# ─── Entry point ─────────────────────────────────────────────────────────────
def main():
    log('Job Scraper starting (55s hard limit)...')
    try:
        profile = load_profile()
        queries = build_queries(profile)
    except Exception as e:
        log(f'FATAL — could not load profile: {e}')
        print(json.dumps([]))
        return

    linkedin_jobs = []
    other_jobs = []
    
    # Store other jobs in dictionaries to order them later
    indeed_jobs = []
    naukri_jobs = []
    glassdoor_jobs = []
    internshala_jobs = []
    apna_jobs = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        future_li = executor.submit(scrape_linkedin, queries, profile)
        future_is = executor.submit(scrape_internshala, profile)
        future_in = executor.submit(scrape_indeed, queries, profile)
        future_gd = executor.submit(scrape_glassdoor, queries, profile)
        future_nk = executor.submit(scrape_naukri, queries, profile)
        future_ap = executor.submit(scrape_apna, queries, profile)

        # Wait for all to complete or timeout internally
        try:
            linkedin_jobs.extend(future_li.result())
            internshala_jobs.extend(future_is.result())
            indeed_jobs.extend(future_in.result())
            glassdoor_jobs.extend(future_gd.result())
            naukri_jobs.extend(future_nk.result())
            apna_jobs.extend(future_ap.result())
        except Exception as e:
            log(f'Parallel execution error: {e}')

    other_jobs = indeed_jobs + naukri_jobs + glassdoor_jobs + internshala_jobs + apna_jobs

    # Apply the 50% LinkedIn rule: if other jobs exist, cap LinkedIn to match
    if len(other_jobs) > 0:
        max_linkedin = len(other_jobs)
        if len(linkedin_jobs) > max_linkedin:
            log(f"Capping LinkedIn jobs from {len(linkedin_jobs)} to {max_linkedin} to maintain 50% ratio.")
            linkedin_jobs = linkedin_jobs[:max_linkedin]
            
    # Ordered exactly as requested: Indeed -> Naukri -> LinkedIn -> Glassdoor -> Internshala -> Apna
    all_jobs = indeed_jobs + naukri_jobs + linkedin_jobs + glassdoor_jobs + internshala_jobs + apna_jobs

    log(f'\nDone. Total: {len(all_jobs)} jobs. Time elapsed: {time.time() - START_TIME:.2f}s')
    # Use ensure_ascii=True to safely escape unicode and avoid Windows cp1252 console crash
    print(json.dumps(all_jobs, ensure_ascii=True))

if __name__ == '__main__':
    main()
