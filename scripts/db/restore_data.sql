--
-- PostgreSQL database dump
--

\restrict FjrhCL4TssMkPA1lqcrZbVfEtDPd9jk5L1uIj1j1tw8cFPbm6zW9YtcxbX1oU9z

-- Dumped from database version 18.3 (Debian 18.3-1.pgdg13+1)
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: action_rules; Type: TABLE DATA; Schema: public; Owner: crc_user
--

COPY public.action_rules (id, action_id, table_name, levels, positions, roles, exceptions, description) FROM stdin;
37	change_sr_owner	request	\N	\N	[POLICY LEAD]		Update SR Owner of this request
\.


--
-- Data for Name: column_permissions; Type: TABLE DATA; Schema: public; Owner: crc_user
--

COPY public.column_permissions (id, table_name, column_name, created_by, created_date, updated_by, updated_date, log, levels, positions, roles, exceptions) FROM stdin;
2	employee	independent_id	\N	2026-03-12 14:59:08.919688	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: customize; Type: TABLE DATA; Schema: public; Owner: crc_user
--

COPY public.customize (id, setting_name, font_family, font_size, text_color, bg_color, menu_icons, created_by, created_date, updated_by, updated_date, log) FROM stdin;
1	default	'Playfair Display', sans-serif	15px	#f2e2bf	#0f1117	{"policy": "📋", "company": "🤝", "contact": "📇", "employee": "👤", "department": "🏛️", "my_company": "🏢", "permissions": "🔐"}	\N	2026-03-12 14:59:08.919688	\N	\N	\N
\.


--
-- PostgreSQL database dump complete
--

\unrestrict FjrhCL4TssMkPA1lqcrZbVfEtDPd9jk5L1uIj1j1tw8cFPbm6zW9YtcxbX1oU9z

