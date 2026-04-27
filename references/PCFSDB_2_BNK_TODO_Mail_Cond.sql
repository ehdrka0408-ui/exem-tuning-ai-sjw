# 고객요청 SQL : PCFSDB_2_BNK_TODO_Mail_Cond

# 성능요약
튜닝 전 :  540000 Block(14.96초)
튜닝 후 :  262000 Block( 4.11초)

# 일별이력

# 바인드 변수


# 튜닝내역
[문제점]
	get_empname, get_sysdate function call 부하
	
		1)  function call 부하(operation id 19, --cond1)
			GET_EMPNAME 12만건 function call -5초 (14초 -> 9초)  
		
		2) function call 부하(operation id 95, --cond7)
			GET_EMPNAME 2.4만건 function call -1.5초 (9초->7.14초)
		
		3) function call 부하(operation id 29 -- cond2) 
			GET_EMPNAME 1만건 function call -0.5초 (7.14초 -> 6.47 )
			
		4) function call 부하 (id 49 --cond4)
			GET_EMPNAME 2.6만건 function call -1초(6.47ch -> 5.41)
		
		
	 - function call 부하(operation id 3 -- main 쿼리블록) -- 영향없음
	 
[가이드]
	function -> SQL로 재작성
		get_empname -> ( select emp_name from ecf_employee where emp_id = v_emp_id )
		get_sysdate -> TO_CHAR(SYSDATE,'yyyymmddhh24miss')


# 튜닝 전 (SQL 및 PLAN)
/* BNK_TODO_Mail_Cond Created By STEG. */ 
select
	id as key 
	, ent_id
	, iss_req_emp_id as emp_id
	, 'ITSM@busanbank.co.kr' as emp_email
	, 'kr' as user_charset
from 
(
	SELECT /* 메인 : 나의 할일 리스트 */
	    T.id AS ID -- ID
	    , E.TAS_ENT_ID AS ENT_ID -- 엔티티 ID
	    , t.iss_cat_cd
	    , case when iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
	    else (SELECT NVL(ENT_LABEL, ENT_NAME)
	        FROM EFC_ENTITY A
	        WHERE A.ENT_ID = E.TAS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
	    , E.TAS_ID -- 단계 ID
	    , E.TAS_NAME
	    , nvl((SELECT MAX(COD_NAME)
	        FROM ECF_CODE A
	        WHERE A.COD_USED=1
	          AND A.COD_ID=T.ISS_CAT_CD),'') AS CAT_NAME
	    , T.ISS_REQ_DTTM as REQ_DTTM -- 요청일
	    , decode(t.iss_dead_dttm,null,TO_DATE(t.iss_req_dttm,'YYYYMMDDHH24MISS'),to_date(substr(t.iss_dead_dttm,1,8),'YYYYMMDD')) as req_dt
	    , t.iss_req_emp_id
	    , t.iss_req_dpt_id
	    , t.iss_req_dttm
	    , t.iss_ent_id
	    --,CASE T.ISS_REQ_TITLE WHEN '' THEN '제목없음' ELSE T.ISS_REQ_TITLE END AS REQ_TITLE -- 제목
	    , CASE
	        WHEN T.REQ_TITLE = '' THEN '제목없음'
	        WHEN T.ISS_CAT_CD ='WORCAT03' AND ISS_TAS_ID IN ('TAS03292','TAS03203') 
	        THEN (SELECT WOR_FORCE_NUM
	                FROM ESO_WORKORDER A
	                WHERE A.WOR_ID = T.id )
	        ELSE T.REQ_TITLE
	        END AS REQ_TITLE -- 제목
	    , ISS_ASS_EMP_ID
	    , GET_EMPNAME(ISS_ASS_EMP_ID) AS ASS_NAME 
	FROM (select 
				* 
			from
				(
				--cond1
				select 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, ei.ISS_ASS_EMP_ID
					, GET_EMPNAME(ei.ISS_ASS_EMP_ID) AS ASS_NAME 
				from ESO_ISSUE ei
				where ei.iss_ass_emp_id is not NULL 
					and ei.iss_tas_id not in ('TAS03165','TCSR12010','TCSR13010','TCHA13010','TCHA14030','TAS03180','TAS03197','TAS03192','TAS03223')
				union
				-- cond2
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then em.MEM_EMP_ID 
							else ei.ISS_ASS_EMP_ID 
						end as iss_ass_emp_id
					, case when ei.ISS_ASS_EMP_ID is null then get_empname(em.MEM_EMP_ID) 
							else GET_EMPNAME(ei.ISS_ASS_EMP_ID) 
						end AS ASS_NAME 
				from ESO_ISSUE ei,
						ECF_MEMBER em
				where ei.iss_ass_wog_id = em.MEM_WOG_ID
					and ei.ISS_TAS_ID NOT IN ('TSRM14010') 	
				    and get_empname(em.MEM_EMP_ID) is not null
				union
				--cond3
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then ec.CHA_PL_EMP_ID 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.ISS_ASS_EMP_ID is null then get_empname(ec.CHA_PL_EMP_ID) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					 (select * from ESO_CHA where CHA_PL_EMP_ID is not null) ec 
				where ei.ISS_SR_ID = ec.CHA_CSR_ID
					AND ei.ISS_TAS_ID IN ('TAS03165','TCSR12010')   
				union
				--cond4
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, ei.ISS_ASS_EMP_ID
					, GET_EMPNAME(ei.ISS_ASS_EMP_ID) AS ASS_NAME
				from ESO_ISSUE ei,
					 (select * from ESO_CHA where CHA_PL_EMP_ID is not null) ec 
					where ei.ISS_SR_ID IN (SELECT CHA_CSR_ID FROM ESO_CHA 
											WHERE CHA_PL_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE 
																WHERE GET_SYSDATE() BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM))
						AND ISS_TAS_ID IN ('TAS03165', 'TCSR12010') 
				union		
				--cond5
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then ew.WOR_ASS_EMP_ID 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.ISS_ASS_EMP_ID is null then get_empname(ew.WOR_ASS_EMP_ID) 
						else get_empname(ei.iss_ass_emp_id) end  AS ASS_NAME
				from ESO_ISSUE ei,
					 eso_workorder ew
					where ei.ISS_SR_ID = ew.WOR_SRC_ID 
					and ew.wor_cla_cd in ('CHIWORMH') AND ei.ISS_TAS_ID IN ('TCHA13010')
				union
				--cond6
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then ew.WOR_ASS_EMP_ID 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.ISS_ASS_EMP_ID is null then get_empname(ew.WOR_ASS_EMP_ID) 
						else get_empname(ei.iss_ass_emp_id) end  AS ASS_NAME
				from ESO_ISSUE ei,
					 eso_workorder ew
					where ei.ISS_SR_ID =  ew.WOR_SRC_ID 
					and WOR_CLA_CD = CASE WHEN (SELECT CHA_CAT_CD FROM ESO_CHA WHERE CHA_ID = ei.ISS_SR_ID) IN ('CHMCAT01','CHMCAT03','CHMCAT05','CHMCAT07')
										   THEN 'CHIWORMHREAL' ELSE 'CHIWORMH' END 
					AND ei.ISS_TAS_ID IN ('TCHA14030')
				union
				--cond7
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then ee.EMP_ID 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.ISS_ASS_EMP_ID is null then get_empname(ee.EMP_ID) 
						else get_empname(ei.iss_ass_emp_id) end  AS ASS_NAME
				from ESO_ISSUE ei,
					ECF_EMPLOYEE ee 
				where ei.ISS_ASS_EMP_ID = ee.EMP_ID
					and GET_SYSDATE() BETWEEN ee.EMP_AGCSTART_DTTM AND ee.EMP_AGCFINISH_DTTM 
					AND 3 != (SELECT TAS_TYPE FROM EWF_TASK WHERE TAS_ID = ei.ISS_TAS_ID) 
				union 
				--cond8
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then em.MEM_EMP_ID 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.ISS_ASS_EMP_ID is null then get_empname(em.MEM_EMP_ID) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ECF_MEMBER em 
					where ei.ISS_ASS_WOG_ID = em.MEM_WOG_ID 
					and em.MEM_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE GET_SYSDATE() BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM ) 
				union
				--cond9
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then ew.WOR_ASS_EMP_ID 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.ISS_ASS_EMP_ID is null then get_empname(ew.WOR_ASS_EMP_ID) 
						else get_empname(ei.iss_ass_emp_id) end  AS ASS_NAME
				from ESO_ISSUE ei,
					ESO_WORKORDER ew 
					where ei.ISS_TAS_ID IN ('TCHA13010', 'TCHA14030') 
					AND ei.ISS_SR_ID = ew.WOR_SRC_ID 
					and ew.WOR_ASS_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE GET_SYSDATE() BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM) 
					AND ew.WOR_CLA_CD NOT IN ('CHIWORHD','CHIWORPEER','CHIWORSRC','CHIWORFORCE') 
				UNION 
				--cond10
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					eso_icm icm,
					(select WFC_SRC_ID from ESO_WF_CODE where wfc_cod_id = 'ITSV2202-04110' and WFC_TYPE_CD ='JOBCAT') ewc
				where ei.ISS_ASS_EMP_ID IS NULL 
					AND ei.ISS_TAS_ID = 'TAS03415'
					AND ei.ISS_SR_ID = icm.ICM_ID 
					AND icm.ICM_EIM_ID IS NOT NULL
				UNION 
				--cond11
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ESO_PBM pbm,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT') ewc
				where ei.ISS_ASS_EMP_ID IS NULL 
				AND ei.ISS_TAS_ID = 'TPBM12010' 
				AND ei.ISS_SR_ID = pbm.PBM_ID 
				and pbm.PBM_TAS_ID ='TPBM12010'  
				and ewc.wfc_cod_id = (SELECT COD_val FROM ECF_CODE WHERE COD_CTY_ID = 'ICMSOL' and cod_id = pbm.PBM_WORK_AREA_CD)
				UNION 
				--cond12
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ESO_SRM srm,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2205-00010') ewc
				where ei.ISS_ASS_EMP_ID IS NULL 
					AND ei.ISS_TAS_ID = 'TSRM23010' 
					AND ei.ISS_SR_ID=srm.SRM_ID 
					and SRM_PC_TF = 'ITSV2205-00010'
				UNION 
				--cond13
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ESO_EVM ev,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-01230') ewc
				where ei.ISS_ASS_EMP_ID IS NULL 
				AND ei.ISS_TAS_ID = 'TEVM11010' 
				AND ei.ISS_SR_ID = ev.EVM_ID 
				and DECODE(ev.EVM_EMP_DPT_ID ,'SM2_BSBK','981','SM1_BSBK','982','SM3_BSBK','983','SM4_BSBK','988',ev.EVM_EMP_DPT_ID ) in (SELECT EMP_DPT_ID FROM ECF_EMPLOYEE WHERE EMP_ID in ( select WFC_SRC_ID from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-01230'))
				AND EVM_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE EMP_AM_YN IS NULL OR EMP_AM_YN = '0') 
				UNION 
				--cond14
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewe.wfe_emp_id 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.iss_ass_emp_id is null then get_empname(ewe.wfe_emp_id) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ESO_WF_EMPS ewe
				where ei.ISS_ASS_EMP_ID IS NULL 
					AND ei.ISS_TAS_ID  IN ('TAS03464','TAS03473') 
					AND ei.ISS_SR_ID = ewe.wfe_src_id 
					and ewe.wfe_type_cd ='CHK_WORK'
				UNION 
				--cond15
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-04110') ewc
				where ei.ISS_ASS_EMP_ID IS NULL 
				AND ISS_CAT_CD = 'OCM_LONGTERM100' 
				union
				--cond16
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-03120') ewc
				where ei.ISS_ASS_EMP_ID IS NULL 
				AND ISS_CAT_CD = 'OCM_LONGTERM110'
				UNION 
				--cond17
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-03130') ewc
				where ei.ISS_ASS_EMP_ID IS NULL 
				AND ISS_CAT_CD = 'OCM_LONGTERM120'
				UNION 
				--cond18
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-03240') ewc
				where ei.ISS_ASS_EMP_ID IS NULL 
				AND ISS_CAT_CD = 'OCM_LONGTERM130' 
				UNION 
				--cond19
				select DISTINCT 
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id 
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id) 
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-03110') ewc
				where ei.ISS_ASS_EMP_ID IS NULL 
				AND ISS_CAT_CD = 'OCM_LONGTERM140' 
				)
			) T
	   , EWF_TASK E
	   , EWF_ACTIVITY A
	   , EWF_WORKFLOW W
	WHERE T.ISS_TAS_ID = E.TAS_ID
	  AND TAS_ENT_ID NOT IN ('UX120')
	  AND E.TAS_TYPE IN ('1','2','4') -- 타스크 유형(접수,처리)  
	  AND E.TAS_ACT_ID = A.ACT_ID
	  AND A.ACT_WOF_ID = W.WOF_ID
) a
where(req_dt+(select ofm_men_num from eso_ofm where ofm_men_num != 0 and ofm_sys_id = ent_id and ofm_med_cd=tas_id )) < SYSDATE 
	 and (
	 		((trunc(sysdate-(req_dt+(select ofm_men_num from eso_ofm where ofm_sys_id = ent_id and ofm_med_cd=tas_id)))) = 1)
		or
			((trunc(sysdate-(req_dt+(select ofm_men_num from eso_ofm where ofm_sys_id = ent_id and ofm_med_cd=tas_id)))) >= 2
			and mod(trunc(sysdate-(to_date(to_char(sysdate,'YYYY')||'0101000000','YYYYMMDDHH24MISS')))
				,to_number((select ofm_export_loc from eso_ofm where ofm_sys_id = ent_id and ofm_med_cd=tas_id))) = 0 )
	 	)		 
order by id





Plan hash value: 647199995

-------------------------------------------------------------------------------------------------------------------------------------------------------------------
| Id  | Operation                                     | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers | Reads  |  OMem |  1Mem | Used-Mem |
-------------------------------------------------------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                              |                     |      1 |        |      0 |00:00:14.96 |     540K|      1 |       |       |          |
|   1 |  SORT ORDER BY                                |                     |      1 |      1 |      0 |00:00:14.96 |     540K|      1 |  1024 |  1024 |          |
|*  2 |   FILTER                                      |                     |      1 |        |      0 |00:00:14.96 |     540K|      1 |       |       |          |
|*  3 |    HASH JOIN                                  |                     |      1 |  60780 |  21751 |00:00:14.89 |     536K|      1 |  1651K|  1651K| 1330K (0)|
|*  4 |     HASH JOIN                                 |                     |      1 |    605 |    594 |00:00:00.01 |      36 |      0 |  1335K|  1335K| 1652K (0)|
|*  5 |      TABLE ACCESS FULL                        | EWF_TASK            |      1 |    606 |    612 |00:00:00.01 |      16 |      0 |       |       |          |
|   6 |      NESTED LOOPS                             |                     |      1 |    601 |    613 |00:00:00.01 |      20 |      0 |       |       |          |
|   7 |       TABLE ACCESS FULL                       | EWF_ACTIVITY        |      1 |    602 |    637 |00:00:00.01 |      16 |      0 |       |       |          |
|*  8 |       INDEX UNIQUE SCAN                       | PK_EWF_WORKFLOW     |    637 |      1 |    613 |00:00:00.01 |       4 |      0 |       |       |          |
|   9 |     VIEW                                      |                     |      1 |    114K|    123K|00:00:14.80 |     536K|      1 |       |       |          |
|  10 |      SORT UNIQUE                              |                     |      1 |    114K|    123K|00:00:14.75 |     536K|      1 |    34M|  2466K|   30M (0)|
|  11 |       UNION-ALL                               |                     |      1 |        |    177K|00:00:14.04 |     536K|      1 |       |       |          |
|  12 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |    190 |      1 |    190 |00:00:00.01 |     198 |      0 |       |       |          |
|* 13 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |    190 |      1 |    190 |00:00:00.01 |       4 |      0 |       |       |          |
|  14 |        SORT AGGREGATE                         |                     |  14653 |      1 |  14653 |00:00:00.17 |   28198 |      0 |       |       |          |
|* 15 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |  14653 |      1 |  14649 |00:00:00.12 |   28198 |      0 |       |       |          |
|* 16 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |  14653 |      1 |  14651 |00:00:00.06 |   13547 |      0 |       |       |          |
|  17 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|* 18 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|* 19 |        TABLE ACCESS FULL                      | ESO_ISSUE           |      1 |    113K|    117K|00:00:00.32 |   15208 |      0 |       |       |          |
|  20 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      3 |      1 |      3 |00:00:00.01 |       5 |      0 |       |       |          |
|* 21 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      3 |      1 |      3 |00:00:00.01 |       2 |      0 |       |       |          |
|  22 |        SORT AGGREGATE                         |                     |     15 |      1 |     15 |00:00:00.01 |      34 |      0 |       |       |          |
|* 23 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |     15 |      1 |     15 |00:00:00.01 |      34 |      0 |       |       |          |
|* 24 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |     15 |      1 |     15 |00:00:00.01 |      19 |      0 |       |       |          |
|  25 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      7 |      1 |      7 |00:00:00.01 |      17 |      0 |       |       |          |
|* 26 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      7 |      1 |      7 |00:00:00.01 |       9 |      0 |       |       |          |
|* 27 |        HASH JOIN                              |                     |      1 |    295 |    136 |00:00:00.73 |   38897 |      0 |   830K|   830K| 1362K (0)|
|* 28 |         TABLE ACCESS FULL                     | ESO_ISSUE           |      1 |     67 |     71 |00:00:00.14 |   15208 |      0 |       |       |          |
|* 29 |         INDEX FAST FULL SCAN                  | IX_ECF_MEMBER_01    |      1 |    588 |  11058 |00:00:00.58 |   23689 |      0 |       |       |          |
|  30 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |      0 |       |       |          |
|* 31 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |      0 |       |       |          |
|  32 |        SORT AGGREGATE                         |                     |      1 |      1 |      1 |00:00:00.01 |       3 |      0 |       |       |          |
|* 33 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      1 |      1 |      1 |00:00:00.01 |       3 |      0 |       |       |          |
|* 34 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      1 |      1 |      1 |00:00:00.01 |       2 |      0 |       |       |          |
|  35 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|* 36 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|  37 |        NESTED LOOPS                           |                     |      1 |     36 |     70 |00:00:00.17 |   15346 |      0 |       |       |          |
|  38 |         NESTED LOOPS                          |                     |      1 |    154 |     70 |00:00:00.17 |   15280 |      0 |       |       |          |
|* 39 |          TABLE ACCESS FULL                    | ESO_ISSUE           |      1 |     77 |     69 |00:00:00.17 |   15208 |      0 |       |       |          |
|* 40 |          INDEX RANGE SCAN                     | IX_ESO_CHA01        |     69 |      2 |     70 |00:00:00.01 |      72 |      0 |       |       |          |
|* 41 |         TABLE ACCESS BY INDEX ROWID           | ESO_CHA             |     70 |      1 |     70 |00:00:00.01 |      66 |      0 |       |       |          |
|  42 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |      0 |       |       |          |
|* 43 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |      0 |       |       |          |
|  44 |        SORT AGGREGATE                         |                     |      1 |      1 |      1 |00:00:00.01 |       3 |      0 |       |       |          |
|* 45 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      1 |      1 |      1 |00:00:00.01 |       3 |      0 |       |       |          |
|* 46 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      1 |      1 |      1 |00:00:00.01 |       2 |      0 |       |       |          |
|  47 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|* 48 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|  49 |        MERGE JOIN CARTESIAN                   |                     |      1 |   1176 |  26324 |00:00:00.16 |   16554 |      0 |       |       |          |
|  50 |         NESTED LOOPS                          |                     |      1 |      1 |      2 |00:00:00.09 |    9050 |      0 |       |       |          |
|  51 |          NESTED LOOPS                         |                     |      1 |     22 |    501 |00:00:00.09 |    8556 |      0 |       |       |          |
|* 52 |           HASH JOIN                           |                     |      1 |     22 |    501 |00:00:00.08 |    7544 |      0 |  1995K|  1995K| 1359K (0)|
|* 53 |            INDEX FAST FULL SCAN               | IX_ECF_EMPLOYEE_07  |      1 |     19 |      9 |00:00:00.02 |      40 |      0 |       |       |          |
|* 54 |            TABLE ACCESS FULL                  | ESO_CHA             |      1 |   8718 |  13162 |00:00:00.05 |    7504 |      0 |       |       |          |
|* 55 |           INDEX RANGE SCAN                    | IX01_ESO_ISSUE      |    501 |      1 |    501 |00:00:00.01 |    1012 |      0 |       |       |          |
|* 56 |          TABLE ACCESS BY INDEX ROWID          | ESO_ISSUE           |    501 |      1 |      2 |00:00:00.01 |     494 |      0 |       |       |          |
|  57 |         BUFFER SORT                           |                     |      2 |  13152 |  26324 |00:00:00.06 |    7504 |      0 |   372K|   372K|  330K (0)|
|* 58 |          TABLE ACCESS FULL                    | ESO_CHA             |      1 |  13152 |  13162 |00:00:00.04 |    7504 |      0 |       |       |          |
|  59 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |      0 |       |       |          |
|* 60 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |      0 |       |       |          |
|  61 |        SORT AGGREGATE                         |                     |      5 |      1 |      5 |00:00:00.01 |      12 |      0 |       |       |          |
|* 62 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      5 |      1 |      5 |00:00:00.01 |      12 |      0 |       |       |          |
|* 63 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      5 |      1 |      5 |00:00:00.01 |       7 |      0 |       |       |          |
|  64 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|* 65 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|  66 |        NESTED LOOPS                           |                     |      1 |    313 |    280 |00:00:00.13 |   15978 |      0 |       |       |          |
|  67 |         NESTED LOOPS                          |                     |      1 |    496 |    566 |00:00:00.13 |   15477 |      0 |       |       |          |
|* 68 |          TABLE ACCESS FULL                    | ESO_ISSUE           |      1 |    248 |    265 |00:00:00.12 |   15208 |      0 |       |       |          |
|* 69 |          INDEX RANGE SCAN                     | IX_ESO_WORKORDER_03 |    265 |      2 |    566 |00:00:00.01 |     269 |      0 |       |       |          |
|* 70 |         TABLE ACCESS BY INDEX ROWID           | ESO_WORKORDER       |    566 |      1 |    280 |00:00:00.01 |     501 |      0 |       |       |          |
|  71 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |      0 |       |       |          |
|* 72 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |      0 |       |       |          |
|  73 |        SORT AGGREGATE                         |                     |      3 |      1 |      3 |00:00:00.01 |       8 |      0 |       |       |          |
|* 74 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      3 |      1 |      3 |00:00:00.01 |       8 |      0 |       |       |          |
|* 75 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      3 |      1 |      3 |00:00:00.01 |       5 |      0 |       |       |          |
|  76 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|* 77 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|* 78 |        FILTER                                 |                     |      1 |        |      9 |00:00:00.12 |   15258 |      0 |       |       |          |
|  79 |         NESTED LOOPS                          |                     |      1 |     16 |     20 |00:00:00.12 |   15236 |      0 |       |       |          |
|  80 |          NESTED LOOPS                         |                     |      1 |     16 |     20 |00:00:00.12 |   15219 |      0 |       |       |          |
|* 81 |           TABLE ACCESS FULL                   | ESO_ISSUE           |      1 |      8 |      9 |00:00:00.12 |   15208 |      0 |       |       |          |
|* 82 |           INDEX RANGE SCAN                    | IX_ESO_WORKORDER_03 |      9 |      2 |     20 |00:00:00.01 |      11 |      0 |       |       |          |
|  83 |          TABLE ACCESS BY INDEX ROWID          | ESO_WORKORDER       |     20 |      2 |     20 |00:00:00.01 |      17 |      0 |       |       |          |
|  84 |         TABLE ACCESS BY INDEX ROWID           | ESO_CHA             |      9 |      1 |      9 |00:00:00.01 |      22 |      0 |       |       |          |
|* 85 |          INDEX UNIQUE SCAN                    | PK_ESO_CHA          |      9 |      1 |      9 |00:00:00.01 |      11 |      0 |       |       |          |
|  86 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |     17 |      1 |     17 |00:00:00.01 |      22 |      0 |       |       |          |
|* 87 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |     17 |      1 |     17 |00:00:00.01 |       4 |      0 |       |       |          |
|  88 |        SORT AGGREGATE                         |                     |     73 |      1 |     73 |00:00:00.01 |     147 |      0 |       |       |          |
|* 89 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |     73 |      1 |     72 |00:00:00.01 |     147 |      0 |       |       |          |
|* 90 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |     73 |      1 |     72 |00:00:00.01 |      75 |      0 |       |       |          |
|  91 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|* 92 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|* 93 |        FILTER                                 |                     |      1 |        |  24092 |00:00:00.36 |   15337 |      0 |       |       |          |
|* 94 |         HASH JOIN                             |                     |      1 |    440 |  24097 |00:00:00.33 |   15248 |      0 |  1922K|  1922K| 1353K (0)|
|* 95 |          INDEX FAST FULL SCAN                 | IX_ECF_EMPLOYEE_07  |      1 |     19 |      9 |00:00:00.02 |      40 |      0 |       |       |          |
|* 96 |          TABLE ACCESS FULL                    | ESO_ISSUE           |      1 |    115K|    117K|00:00:00.20 |   15208 |      0 |       |       |          |
|  97 |         TABLE ACCESS BY INDEX ROWID           | EWF_TASK            |     43 |      1 |     43 |00:00:00.01 |      89 |      0 |       |       |          |
|* 98 |          INDEX UNIQUE SCAN                    | PK_EWF_TASK         |     43 |      1 |     43 |00:00:00.01 |      46 |      0 |       |       |          |
|  99 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |      0 |       |       |          |
|*100 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |      0 |       |       |          |
| 101 |        SORT AGGREGATE                         |                     |      2 |      1 |      2 |00:00:00.01 |       6 |      0 |       |       |          |
|*102 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      2 |      1 |      2 |00:00:00.01 |       6 |      0 |       |       |          |
|*103 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      2 |      1 |      2 |00:00:00.01 |       4 |      0 |       |       |          |
| 104 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*105 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*106 |        HASH JOIN                              |                     |      1 |     33 |      9 |00:00:00.16 |   15259 |      0 |  1399K|  1399K| 1230K (0)|
| 107 |         NESTED LOOPS                          |                     |      1 |     65 |     39 |00:00:00.02 |      51 |      0 |       |       |          |
|*108 |          INDEX FAST FULL SCAN                 | IX_ECF_EMPLOYEE_07  |      1 |     19 |      9 |00:00:00.02 |      40 |      0 |       |       |          |
|*109 |          INDEX RANGE SCAN                     | IX_ECF_MEMBER_01    |      9 |      3 |     39 |00:00:00.01 |      11 |      0 |       |       |          |
|*110 |         TABLE ACCESS FULL                     | ESO_ISSUE           |      1 |     68 |     71 |00:00:00.14 |   15208 |      0 |       |       |          |
| 111 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*112 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 113 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*114 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*115 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 116 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*117 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 118 |        NESTED LOOPS                           |                     |      1 |      1 |      0 |00:00:00.03 |    1676 |      1 |       |       |          |
| 119 |         NESTED LOOPS                          |                     |      1 |    151 |    245 |00:00:00.03 |    1474 |      1 |       |       |          |
| 120 |          NESTED LOOPS                         |                     |      1 |    151 |    517 |00:00:00.02 |     371 |      1 |       |       |          |
|*121 |           INDEX FAST FULL SCAN                | IX_ECF_EMPLOYEE_07  |      1 |     19 |      9 |00:00:00.02 |      40 |      0 |       |       |          |
|*122 |           TABLE ACCESS BY INDEX ROWID BATCHED | ESO_WORKORDER       |      9 |      8 |    517 |00:00:00.01 |     331 |      1 |       |       |          |
|*123 |            INDEX RANGE SCAN                   | IX_ESO_WORKORDER_01 |      9 |    239 |    546 |00:00:00.01 |      13 |      1 |       |       |          |
|*124 |          INDEX RANGE SCAN                     | IX01_ESO_ISSUE      |    517 |      1 |    245 |00:00:00.01 |    1103 |      0 |       |       |          |
|*125 |         TABLE ACCESS BY INDEX ROWID           | ESO_ISSUE           |    245 |      1 |      0 |00:00:00.01 |     202 |      0 |       |       |          |
| 126 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*127 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 128 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*129 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*130 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 131 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*132 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 133 |        MERGE JOIN CARTESIAN                   |                     |      1 |      1 |      0 |00:00:00.01 |     127 |      0 |       |       |          |
| 134 |         NESTED LOOPS                          |                     |      1 |      1 |      0 |00:00:00.01 |     127 |      0 |       |       |          |
| 135 |          NESTED LOOPS                         |                     |      1 |      1 |      0 |00:00:00.01 |     127 |      0 |       |       |          |
|*136 |           TABLE ACCESS FULL                   | ESO_ICM             |      1 |      1 |      0 |00:00:00.01 |     127 |      0 |       |       |          |
|*137 |           INDEX RANGE SCAN                    | IX01_ESO_ISSUE      |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*138 |          TABLE ACCESS BY INDEX ROWID          | ESO_ISSUE           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 139 |         BUFFER SORT                           |                     |      0 |      1 |      0 |00:00:00.01 |       0 |      0 | 73728 | 73728 |          |
|*140 |          INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 141 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*142 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 143 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*144 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*145 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 146 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*147 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 148 |        NESTED LOOPS                           |                     |      1 |      1 |      0 |00:00:00.01 |     318 |      0 |       |       |          |
| 149 |         NESTED LOOPS                          |                     |      1 |      1 |      0 |00:00:00.01 |     318 |      0 |       |       |          |
|*150 |          TABLE ACCESS FULL                    | ESO_PBM             |      1 |      1 |      0 |00:00:00.01 |     318 |      0 |       |       |          |
|*151 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*152 |           INDEX RANGE SCAN                    | IX01_ESO_ISSUE      |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*153 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*154 |          TABLE ACCESS BY INDEX ROWID          | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*155 |           INDEX UNIQUE SCAN                   | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 156 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*157 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 158 |        SORT AGGREGATE                         |                     |      1 |      1 |      1 |00:00:00.01 |       3 |      0 |       |       |          |
|*159 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      1 |      1 |      1 |00:00:00.01 |       3 |      0 |       |       |          |
|*160 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      1 |      1 |      1 |00:00:00.01 |       2 |      0 |       |       |          |
| 161 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*162 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 163 |        NESTED LOOPS                           |                     |      1 |      1 |     36 |00:00:00.12 |   15326 |      0 |       |       |          |
| 164 |         NESTED LOOPS                          |                     |      1 |      1 |     36 |00:00:00.12 |   15254 |      0 |       |       |          |
| 165 |          MERGE JOIN CARTESIAN                 |                     |      1 |      1 |     36 |00:00:00.12 |   15213 |      0 |       |       |          |
|*166 |           INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      1 |      1 |      3 |00:00:00.01 |       5 |      0 |       |       |          |
| 167 |           BUFFER SORT                         |                     |      3 |      4 |     36 |00:00:00.12 |   15208 |      0 |  2048 |  2048 | 2048  (0)|
|*168 |            TABLE ACCESS FULL                  | ESO_ISSUE           |      1 |      4 |     12 |00:00:00.12 |   15208 |      0 |       |       |          |
|*169 |          INDEX UNIQUE SCAN                    | PK_ESO_SRM          |     36 |      1 |     36 |00:00:00.01 |      41 |      0 |       |       |          |
|*170 |         TABLE ACCESS BY INDEX ROWID           | ESO_SRM             |     36 |      1 |     36 |00:00:00.01 |      72 |      0 |       |       |          |
| 171 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |      0 |       |       |          |
|*172 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |      0 |       |       |          |
| 173 |        SORT AGGREGATE                         |                     |      2 |      1 |      2 |00:00:00.01 |       6 |      0 |       |       |          |
|*174 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      2 |      1 |      2 |00:00:00.01 |       6 |      0 |       |       |          |
|*175 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      2 |      1 |      2 |00:00:00.01 |       4 |      0 |       |       |          |
| 176 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*177 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 178 |        MERGE JOIN CARTESIAN                   |                     |      1 |      1 |   8355 |00:00:00.04 |    3708 |      0 |       |       |          |
| 179 |         NESTED LOOPS                          |                     |      1 |      1 |    557 |00:00:00.03 |    3703 |      0 |       |       |          |
| 180 |          NESTED LOOPS                         |                     |      1 |      1 |    563 |00:00:00.02 |    2972 |      0 |       |       |          |
| 181 |           NESTED LOOPS                        |                     |      1 |      1 |    563 |00:00:00.02 |    2409 |      0 |       |       |          |
|*182 |            HASH JOIN                          |                     |      1 |      1 |    652 |00:00:00.01 |     179 |      0 |  2402K|  2402K|  974K (0)|
|*183 |             HASH JOIN                         |                     |      1 |      1 |     15 |00:00:00.01 |      53 |      0 |  1856K|  1856K| 1046K (0)|
|*184 |              INDEX RANGE SCAN                 | IX01_ESO_WF_CODE    |      1 |      1 |     15 |00:00:00.01 |       5 |      0 |       |       |          |
| 185 |              INDEX FAST FULL SCAN             | IX_ECF_EMPLOYEE_08  |      1 |      1 |   7792 |00:00:00.01 |      48 |      0 |       |       |          |
| 186 |             TABLE ACCESS FULL                 | ESO_EVM             |      1 |    321 |    322 |00:00:00.01 |     126 |      0 |       |       |          |
|*187 |            TABLE ACCESS BY INDEX ROWID BATCHED| ESO_ISSUE           |    652 |      1 |    563 |00:00:00.01 |    2230 |      0 |       |       |          |
|*188 |             INDEX RANGE SCAN                  | IX01_ESO_ISSUE      |    652 |      1 |   1265 |00:00:00.01 |     977 |      0 |       |       |          |
|*189 |           INDEX UNIQUE SCAN                   | SYS_C0020079        |    563 |      1 |    563 |00:00:00.01 |     563 |      0 |       |       |          |
|*190 |          TABLE ACCESS BY INDEX ROWID          | ECF_EMPLOYEE        |    563 |      1 |    557 |00:00:00.01 |     731 |      0 |       |       |          |
| 191 |         BUFFER SORT                           |                     |    557 |      1 |   8355 |00:00:00.01 |       5 |      0 |  2048 |  2048 | 2048  (0)|
|*192 |          INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      1 |      1 |     15 |00:00:00.01 |       5 |      0 |       |       |          |
| 193 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      2 |      1 |      2 |00:00:00.01 |       4 |      0 |       |       |          |
|*194 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      2 |      1 |      2 |00:00:00.01 |       2 |      0 |       |       |          |
| 195 |        SORT AGGREGATE                         |                     |      3 |      1 |      3 |00:00:00.01 |       8 |      0 |       |       |          |
|*196 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      3 |      1 |      3 |00:00:00.01 |       8 |      0 |       |       |          |
|*197 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      3 |      1 |      3 |00:00:00.01 |       5 |      0 |       |       |          |
| 198 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*199 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*200 |        HASH JOIN                              |                     |      1 |    509 |    963 |00:00:00.38 |   17733 |      0 |   897K|   897K| 1385K (0)|
|*201 |         TABLE ACCESS FULL                     | ESO_ISSUE           |      1 |    176 |    347 |00:00:00.14 |   15208 |      0 |       |       |          |
|*202 |         INDEX FAST FULL SCAN                  | IX01_ESO_WF_EMPS    |      1 |    215K|    232K|00:00:00.09 |    2525 |      0 |       |       |          |
| 203 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*204 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 205 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*206 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*207 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 208 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*209 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 210 |        MERGE JOIN CARTESIAN                   |                     |      1 |      4 |      0 |00:00:00.07 |    3735 |      0 |       |       |          |
|*211 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      1 |      1 |      3 |00:00:00.01 |       5 |      0 |       |       |          |
| 212 |         BUFFER SORT                           |                     |      3 |     18 |      0 |00:00:00.07 |    3730 |      0 |  1024 |  1024 |          |
|*213 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      1 |     18 |      0 |00:00:00.07 |    3730 |      0 |       |       |          |
|*214 |           INDEX SKIP SCAN                     | IX01_ESO_ISSUE      |      1 |     35 |     35 |00:00:00.07 |    3696 |      0 |       |       |          |
| 215 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*216 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 217 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*218 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*219 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 220 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*221 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 222 |        MERGE JOIN CARTESIAN                   |                     |      1 |      3 |      0 |00:00:00.07 |    3732 |      0 |       |       |          |
|*223 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      1 |      1 |      3 |00:00:00.01 |       5 |      0 |       |       |          |
| 224 |         BUFFER SORT                           |                     |      3 |     16 |      0 |00:00:00.07 |    3727 |      0 |  1024 |  1024 |          |
|*225 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      1 |     16 |      0 |00:00:00.07 |    3727 |      0 |       |       |          |
|*226 |           INDEX SKIP SCAN                     | IX01_ESO_ISSUE      |      1 |     31 |     33 |00:00:00.07 |    3694 |      0 |       |       |          |
| 227 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*228 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 229 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*230 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*231 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 232 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*233 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 234 |        MERGE JOIN CARTESIAN                   |                     |      1 |      3 |      0 |00:00:00.06 |    3732 |      0 |       |       |          |
|*235 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      1 |      1 |      3 |00:00:00.01 |       5 |      0 |       |       |          |
| 236 |         BUFFER SORT                           |                     |      3 |     16 |      0 |00:00:00.06 |    3727 |      0 |  1024 |  1024 |          |
|*237 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      1 |     16 |      0 |00:00:00.06 |    3727 |      0 |       |       |          |
|*238 |           INDEX SKIP SCAN                     | IX01_ESO_ISSUE      |      1 |     31 |     33 |00:00:00.06 |    3694 |      0 |       |       |          |
| 239 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*240 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 241 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*242 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*243 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 244 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*245 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 246 |        MERGE JOIN CARTESIAN                   |                     |      1 |      4 |      0 |00:00:00.06 |    3732 |      0 |       |       |          |
|*247 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      1 |      1 |     11 |00:00:00.01 |       5 |      0 |       |       |          |
| 248 |         BUFFER SORT                           |                     |     11 |     16 |      0 |00:00:00.06 |    3727 |      0 |  1024 |  1024 |          |
|*249 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      1 |     16 |      0 |00:00:00.06 |    3727 |      0 |       |       |          |
|*250 |           INDEX SKIP SCAN                     | IX01_ESO_ISSUE      |      1 |     31 |     33 |00:00:00.06 |    3694 |      0 |       |       |          |
| 251 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*252 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 253 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*254 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*255 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 256 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
|*257 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
| 258 |        MERGE JOIN CARTESIAN                   |                     |      1 |      8 |      0 |00:00:00.06 |    3732 |      0 |       |       |          |
|*259 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      1 |      1 |     20 |00:00:00.01 |       5 |      0 |       |       |          |
| 260 |         BUFFER SORT                           |                     |     20 |     16 |      0 |00:00:00.06 |    3727 |      0 |  1024 |  1024 |          |
|*261 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      1 |     16 |      0 |00:00:00.06 |    3727 |      0 |       |       |          |
|*262 |           INDEX SKIP SCAN                     | IX01_ESO_ISSUE      |      1 |     31 |     33 |00:00:00.06 |    3694 |      0 |       |       |          |
|*263 |    TABLE ACCESS FULL                          | ESO_OFM             |     71 |      1 |      2 |00:00:00.02 |    3905 |      0 |       |       |          |
|*264 |    TABLE ACCESS FULL                          | ESO_OFM             |      2 |      1 |      2 |00:00:00.01 |     110 |      0 |       |       |          |
|*265 |    TABLE ACCESS FULL                          | ESO_OFM             |      2 |      1 |      2 |00:00:00.01 |     110 |      0 |       |       |          |
|*266 |    TABLE ACCESS FULL                          | ESO_OFM             |      0 |      1 |      0 |00:00:00.01 |       0 |      0 |       |       |          |
-------------------------------------------------------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - filter((DECODE("from$_subquery$_006"."ISS_DEAD_DTTM",NULL,TO_DATE("from$_subquery$_006"."ISS_REQ_DTTM",'YYYYMMDDHH24MISS'),TO_DATE(SUBSTR("from$_sub
              query$_006"."ISS_DEAD_DTTM",1,8),'YYYYMMDD'))+<SYSDATE@! AND (TRUNC(SYSDATE@!-(DECODE("from$_subquery$_006"."ISS_DEAD_DTTM",NULL,TO_DATE("from$_subquery$_0
              06"."ISS_REQ_DTTM",'YYYYMMDDHH24MISS'),TO_DATE(SUBSTR("from$_subquery$_006"."ISS_DEAD_DTTM",1,8),'YYYYMMDD'))+))=1 OR
              (MOD(TRUNC(SYSDATE@!-TO_DATE(TO_CHAR(SYSDATE@!,'YYYY')||'0101000000','YYYYMMDDHH24MISS')),TO_NUMBER())=0 AND
              TRUNC(SYSDATE@!-(DECODE("from$_subquery$_006"."ISS_DEAD_DTTM",NULL,TO_DATE("from$_subquery$_006"."ISS_REQ_DTTM",'YYYYMMDDHH24MISS'),TO_DATE(SUBSTR("from$_s
              ubquery$_006"."ISS_DEAD_DTTM",1,8),'YYYYMMDD'))+))>=2))))
   3 - access("from$_subquery$_006"."ISS_TAS_ID"="E"."TAS_ID")
   4 - access("E"."TAS_ACT_ID"="A"."ACT_ID")
   5 - filter((INTERNAL_FUNCTION("E"."TAS_TYPE") AND "TAS_ENT_ID"<>'UX120'))
   8 - access("A"."ACT_WOF_ID"="W"."WOF_ID")
  13 - access("A"."ENT_ID"=:B1)
  15 - filter(TO_NUMBER("A"."COD_USED")=1)
  16 - access("A"."COD_ID"=:B1)
  18 - access("A"."WOR_ID"=:B1)
  19 - filter(("EI"."ISS_ASS_EMP_ID" IS NOT NULL AND "EI"."ISS_TAS_ID"<>'TCHA13010' AND "EI"."ISS_TAS_ID"<>'TCSR13010' AND "EI"."ISS_TAS_ID"<>'TAS03165'
              AND "EI"."ISS_TAS_ID"<>'TCSR12010' AND "EI"."ISS_TAS_ID"<>'TCHA14030' AND "EI"."ISS_TAS_ID"<>'TAS03180' AND "EI"."ISS_TAS_ID"<>'TAS03197' AND
              "EI"."ISS_TAS_ID"<>'TAS03192' AND "EI"."ISS_TAS_ID"<>'TAS03223'))
  21 - access("A"."ENT_ID"=:B1)
  23 - filter(TO_NUMBER("A"."COD_USED")=1)
  24 - access("A"."COD_ID"=:B1)
  26 - access("A"."WOR_ID"=:B1)
  27 - access("EI"."ISS_ASS_WOG_ID"="EM"."MEM_WOG_ID")
  28 - filter(("EI"."ISS_ASS_WOG_ID" IS NOT NULL AND "EI"."ISS_TAS_ID"<>'TSRM14010'))
  29 - filter("GET_EMPNAME"("EM"."MEM_EMP_ID") IS NOT NULL)
  31 - access("A"."ENT_ID"=:B1)
  33 - filter(TO_NUMBER("A"."COD_USED")=1)
  34 - access("A"."COD_ID"=:B1)
  36 - access("A"."WOR_ID"=:B1)
  39 - filter(("EI"."ISS_TAS_ID"='TAS03165' OR "EI"."ISS_TAS_ID"='TCSR12010'))
  40 - access("EI"."ISS_SR_ID"="ESO_CHA"."CHA_CSR_ID")
       filter("ESO_CHA"."CHA_CSR_ID" IS NOT NULL)
  41 - filter("CHA_PL_EMP_ID" IS NOT NULL)
  43 - access("A"."ENT_ID"=:B1)
  45 - filter(TO_NUMBER("A"."COD_USED")=1)
  46 - access("A"."COD_ID"=:B1)
  48 - access("A"."WOR_ID"=:B1)
  52 - access("CHA_PL_EMP_ID"="EMP_ID")
  53 - filter(("EMP_AGCSTART_DTTM"<="GET_SYSDATE"() AND "EMP_AGCFINISH_DTTM">="GET_SYSDATE"()))
  54 - filter(("CHA_PL_EMP_ID" IS NOT NULL AND "CHA_CSR_ID" IS NOT NULL))
  55 - access("EI"."ISS_SR_ID"="CHA_CSR_ID")
  56 - filter(("ISS_TAS_ID"='TAS03165' OR "ISS_TAS_ID"='TCSR12010'))
  58 - filter("CHA_PL_EMP_ID" IS NOT NULL)
  60 - access("A"."ENT_ID"=:B1)
  62 - filter(TO_NUMBER("A"."COD_USED")=1)
  63 - access("A"."COD_ID"=:B1)
  65 - access("A"."WOR_ID"=:B1)
  68 - filter("EI"."ISS_TAS_ID"='TCHA13010')
  69 - access("EI"."ISS_SR_ID"="EW"."WOR_SRC_ID")
  70 - filter("EW"."WOR_CLA_CD"='CHIWORMH')
  72 - access("A"."ENT_ID"=:B1)
  74 - filter(TO_NUMBER("A"."COD_USED")=1)
  75 - access("A"."COD_ID"=:B1)
  77 - access("A"."WOR_ID"=:B1)
  78 - filter("WOR_CLA_CD"=CASE  WHEN ((='CHMCAT01') OR (='CHMCAT03') OR (='CHMCAT05') OR (='CHMCAT07')) THEN 'CHIWORMHREAL' ELSE 'CHIWORMH' END )
  81 - filter("EI"."ISS_TAS_ID"='TCHA14030')
  82 - access("EI"."ISS_SR_ID"="EW"."WOR_SRC_ID")
  85 - access("CHA_ID"=:B1)
  87 - access("A"."ENT_ID"=:B1)
  89 - filter(TO_NUMBER("A"."COD_USED")=1)
  90 - access("A"."COD_ID"=:B1)
  92 - access("A"."WOR_ID"=:B1)
  93 - filter(TO_NUMBER()<>3)
  94 - access("EI"."ISS_ASS_EMP_ID"="EE"."EMP_ID")
  95 - filter(("EE"."EMP_AGCSTART_DTTM"<="GET_SYSDATE"() AND "EE"."EMP_AGCFINISH_DTTM">="GET_SYSDATE"()))
  96 - filter("EI"."ISS_ASS_EMP_ID" IS NOT NULL)
  98 - access("TAS_ID"=:B1)
 100 - access("A"."ENT_ID"=:B1)
 102 - filter(TO_NUMBER("A"."COD_USED")=1)
 103 - access("A"."COD_ID"=:B1)
 105 - access("A"."WOR_ID"=:B1)
 106 - access("EI"."ISS_ASS_WOG_ID"="EM"."MEM_WOG_ID")
 108 - filter(("EMP_AGCSTART_DTTM"<="GET_SYSDATE"() AND "EMP_AGCFINISH_DTTM">="GET_SYSDATE"()))
 109 - access("EM"."MEM_EMP_ID"="EMP_ID")
 110 - filter("EI"."ISS_ASS_WOG_ID" IS NOT NULL)
 112 - access("A"."ENT_ID"=:B1)
 114 - filter(TO_NUMBER("A"."COD_USED")=1)
 115 - access("A"."COD_ID"=:B1)
 117 - access("A"."WOR_ID"=:B1)
 121 - filter(("EMP_AGCSTART_DTTM"<="GET_SYSDATE"() AND "EMP_AGCFINISH_DTTM">="GET_SYSDATE"()))
 122 - filter(("EW"."WOR_CLA_CD"<>'CHIWORHD' AND "EW"."WOR_CLA_CD"<>'CHIWORPEER' AND "EW"."WOR_CLA_CD"<>'CHIWORFORCE' AND "EW"."WOR_CLA_CD"<>'CHIWORSRC'))
 123 - access("EW"."WOR_ASS_EMP_ID"="EMP_ID")
 124 - access("EI"."ISS_SR_ID"="EW"."WOR_SRC_ID")
 125 - filter(("EI"."ISS_TAS_ID"='TCHA13010' OR "EI"."ISS_TAS_ID"='TCHA14030'))
 127 - access("A"."ENT_ID"=:B1)
 129 - filter(TO_NUMBER("A"."COD_USED")=1)
 130 - access("A"."COD_ID"=:B1)
 132 - access("A"."WOR_ID"=:B1)
 136 - filter("ICM"."ICM_EIM_ID" IS NOT NULL)
 137 - access("EI"."ISS_SR_ID"="ICM"."ICM_ID")
 138 - filter(("EI"."ISS_ASS_EMP_ID" IS NULL AND "EI"."ISS_TAS_ID"='TAS03415'))
 140 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-04110')
       filter("WFC_COD_ID"='ITSV2202-04110')
 142 - access("A"."ENT_ID"=:B1)
 144 - filter(TO_NUMBER("A"."COD_USED")=1)
 145 - access("A"."COD_ID"=:B1)
 147 - access("A"."WOR_ID"=:B1)
 150 - filter("PBM"."PBM_TAS_ID"='TPBM12010')
 151 - filter(("EI"."ISS_ASS_EMP_ID" IS NULL AND "EI"."ISS_TAS_ID"='TPBM12010'))
 152 - access("EI"."ISS_SR_ID"="PBM"."PBM_ID")
 153 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"=)
       filter("WFC_COD_ID"=)
 154 - filter("COD_CTY_ID"='ICMSOL')
 155 - access("COD_ID"=:B1)
 157 - access("A"."ENT_ID"=:B1)
 159 - filter(TO_NUMBER("A"."COD_USED")=1)
 160 - access("A"."COD_ID"=:B1)
 162 - access("A"."WOR_ID"=:B1)
 166 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2205-00010')
       filter("WFC_COD_ID"='ITSV2205-00010')
 168 - filter(("EI"."ISS_ASS_EMP_ID" IS NULL AND "EI"."ISS_TAS_ID"='TSRM23010'))
 169 - access("EI"."ISS_SR_ID"="SRM"."SRM_ID")
 170 - filter("SRM_PC_TF"='ITSV2205-00010')
 172 - access("A"."ENT_ID"=:B1)
 174 - filter(TO_NUMBER("A"."COD_USED")=1)
 175 - access("A"."COD_ID"=:B1)
 177 - access("A"."WOR_ID"=:B1)
 182 - access("EMP_DPT_ID"=DECODE("EV"."EVM_EMP_DPT_ID",'SM2_BSBK','981','SM1_BSBK','982','SM3_BSBK','983','SM4_BSBK','988',"EV"."EVM_EMP_DPT_ID"))
 183 - access("EMP_ID"="WFC_SRC_ID")
 184 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-01230')
       filter("WFC_COD_ID"='ITSV2202-01230')
 187 - filter(("EI"."ISS_ASS_EMP_ID" IS NULL AND "EI"."ISS_TAS_ID"='TEVM11010'))
 188 - access("EI"."ISS_SR_ID"="EV"."EVM_ID")
 189 - access("EVM_EMP_ID"="EMP_ID")
 190 - filter(("EMP_AM_YN" IS NULL OR "EMP_AM_YN"='0'))
 192 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-01230')
       filter("WFC_COD_ID"='ITSV2202-01230')
 194 - access("A"."ENT_ID"=:B1)
 196 - filter(TO_NUMBER("A"."COD_USED")=1)
 197 - access("A"."COD_ID"=:B1)
 199 - access("A"."WOR_ID"=:B1)
 200 - access("EI"."ISS_SR_ID"="EWE"."WFE_SRC_ID")
 201 - filter(("EI"."ISS_ASS_EMP_ID" IS NULL AND INTERNAL_FUNCTION("EI"."ISS_TAS_ID")))
 202 - filter("EWE"."WFE_TYPE_CD"='CHK_WORK')
 204 - access("A"."ENT_ID"=:B1)
 206 - filter(TO_NUMBER("A"."COD_USED")=1)
 207 - access("A"."COD_ID"=:B1)
 209 - access("A"."WOR_ID"=:B1)
 211 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-04110')
       filter("WFC_COD_ID"='ITSV2202-04110')
 213 - filter("EI"."ISS_ASS_EMP_ID" IS NULL)
 214 - access("ISS_CAT_CD"='OCM_LONGTERM100')
       filter("ISS_CAT_CD"='OCM_LONGTERM100')
 216 - access("A"."ENT_ID"=:B1)
 218 - filter(TO_NUMBER("A"."COD_USED")=1)
 219 - access("A"."COD_ID"=:B1)
 221 - access("A"."WOR_ID"=:B1)
 223 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-03120')
       filter("WFC_COD_ID"='ITSV2202-03120')
 225 - filter("EI"."ISS_ASS_EMP_ID" IS NULL)
 226 - access("ISS_CAT_CD"='OCM_LONGTERM110')
       filter("ISS_CAT_CD"='OCM_LONGTERM110')
 228 - access("A"."ENT_ID"=:B1)
 230 - filter(TO_NUMBER("A"."COD_USED")=1)
 231 - access("A"."COD_ID"=:B1)
 233 - access("A"."WOR_ID"=:B1)
 235 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-03130')
       filter("WFC_COD_ID"='ITSV2202-03130')
 237 - filter("EI"."ISS_ASS_EMP_ID" IS NULL)
 238 - access("ISS_CAT_CD"='OCM_LONGTERM120')
       filter("ISS_CAT_CD"='OCM_LONGTERM120')
 240 - access("A"."ENT_ID"=:B1)
 242 - filter(TO_NUMBER("A"."COD_USED")=1)
 243 - access("A"."COD_ID"=:B1)
 245 - access("A"."WOR_ID"=:B1)
 247 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-03240')
       filter("WFC_COD_ID"='ITSV2202-03240')
 249 - filter("EI"."ISS_ASS_EMP_ID" IS NULL)
 250 - access("ISS_CAT_CD"='OCM_LONGTERM130')
       filter("ISS_CAT_CD"='OCM_LONGTERM130')
 252 - access("A"."ENT_ID"=:B1)
 254 - filter(TO_NUMBER("A"."COD_USED")=1)
 255 - access("A"."COD_ID"=:B1)
 257 - access("A"."WOR_ID"=:B1)
 259 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-03110')
       filter("WFC_COD_ID"='ITSV2202-03110')
 261 - filter("EI"."ISS_ASS_EMP_ID" IS NULL)
 262 - access("ISS_CAT_CD"='OCM_LONGTERM140')
       filter("ISS_CAT_CD"='OCM_LONGTERM140')
 263 - filter(("OFM_MED_CD"=:B1 AND "OFM_MEN_NUM"<>0 AND "OFM_SYS_ID"=:B2))
 264 - filter(("OFM_MED_CD"=:B1 AND "OFM_SYS_ID"=:B2))
 265 - filter(("OFM_MED_CD"=:B1 AND "OFM_SYS_ID"=:B2))
 266 - filter(("OFM_MED_CD"=:B1 AND "OFM_SYS_ID"=:B2))


# 튜닝 후 (SQL 및 PLAN) 


/* BNK_TODO_Mail_Cond Created By STEG. */

select
	id as key
	, ent_id
	, iss_req_emp_id as emp_id
	, 'ITSM@busanbank.co.kr' as emp_email
	, 'kr' as user_charset
from
(
	SELECT /* 메인 : 나의 할일 리스트 */
	    T.id AS ID -- ID
	    , E.TAS_ENT_ID AS ENT_ID -- 엔티티 ID
	    , t.iss_cat_cd
	    , case when iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
	    else (SELECT NVL(ENT_LABEL, ENT_NAME)
	        FROM EFC_ENTITY A
	        WHERE A.ENT_ID = E.TAS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
	    , E.TAS_ID -- 단계 ID
	    , E.TAS_NAME
	    , nvl((SELECT MAX(COD_NAME)
	        FROM ECF_CODE A
	        WHERE A.COD_USED=1
	          AND A.COD_ID=T.ISS_CAT_CD),'') AS CAT_NAME
	    , T.ISS_REQ_DTTM as REQ_DTTM -- 요청일
	    , decode(t.iss_dead_dttm,null,TO_DATE(t.iss_req_dttm,'YYYYMMDDHH24MISS'),to_date(substr(t.iss_dead_dttm,1,8),'YYYYMMDD')) as req_dt
	    , t.iss_req_emp_id
	    , t.iss_req_dpt_id
	    , t.iss_req_dttm
	    , t.iss_ent_id
	    --,CASE T.ISS_REQ_TITLE WHEN '' THEN '제목없음' ELSE T.ISS_REQ_TITLE END AS REQ_TITLE -- 제목
	    , CASE
	        WHEN T.REQ_TITLE = '' THEN '제목없음'
	        WHEN T.ISS_CAT_CD ='WORCAT03' AND ISS_TAS_ID IN ('TAS03292','TAS03203')
	        THEN (SELECT WOR_FORCE_NUM
	                FROM ESO_WORKORDER A
	                WHERE A.WOR_ID = T.id )
	        ELSE T.REQ_TITLE
	        END AS REQ_TITLE -- 제목
	    , ISS_ASS_EMP_ID
	    , GET_EMPNAME(ISS_ASS_EMP_ID) AS ASS_NAME
	FROM (select
				*
			from
				(
				--cond1
				select
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, ei.ISS_ASS_EMP_ID
					-- , GET_EMPNAME(ei.ISS_ASS_EMP_ID) AS ASS_NAME  -- modified by exem
					, (select emp_name from ecf_employee where emp_id=ei.ISS_ASS_EMP_ID) ass_name --added  by  exem
				from ESO_ISSUE ei
				where ei.iss_ass_emp_id is not NULL
					and ei.iss_tas_id not in ('TAS03165','TCSR12010','TCSR13010','TCHA13010','TCHA14030','TAS03180','TAS03197','TAS03192','TAS03223')
				union
				-- cond2
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then em.MEM_EMP_ID
							else ei.ISS_ASS_EMP_ID
						end as iss_ass_emp_id
					, case when ei.ISS_ASS_EMP_ID is null then get_empname(em.MEM_EMP_ID)
							else GET_EMPNAME(ei.ISS_ASS_EMP_ID)
						end AS ASS_NAME
				from ESO_ISSUE ei,
						ECF_MEMBER em
				where ei.iss_ass_wog_id = em.MEM_WOG_ID
					and ei.ISS_TAS_ID NOT IN ('TSRM14010')
--				    and get_empname(em.MEM_EMP_ID) is not null   --modified by exem
                    and (select emp_name from ecf_employee where emp_id=em.MEM_EMP_ID) is not null
				union
				--cond3
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then ec.CHA_PL_EMP_ID
						else ei.iss_ass_emp_id end as iss_ass_emp_id
					, case when ei.ISS_ASS_EMP_ID is null then get_empname(ec.CHA_PL_EMP_ID)
						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					 (select * from ESO_CHA where CHA_PL_EMP_ID is not null) ec
				where ei.ISS_SR_ID = ec.CHA_CSR_ID
					AND ei.ISS_TAS_ID IN ('TAS03165','TCSR12010')
				union
				--cond4
                SELECT DISTINCT ei.iss_sr_id AS id -- ID
                       ,
                       ei.iss_cat_cd ,
                       CASE
                           WHEN ei.iss_cat_cd IN ( 'COD03601' , 'COD03602' , 'COD03603' )
                           THEN '서비스요청관리'
                           ELSE (
                                 SELECT NVL( ent_label , ent_name )
                                 FROM   efc_entity a
                                 WHERE  a.ent_id = ei.iss_ent_id
                                )
                       END AS locale_ent_nm -- 엔티티명
                       ,
                       NVL( (
                             SELECT MAX( cod_name )
                             FROM   ecf_code a
                             WHERE  a.cod_used=1
                             AND    a.cod_id=ei.iss_cat_cd
                            ) , '' ) AS cat_name ,
                       ei.iss_req_dttm AS req_dttm -- 요청일
                       ,
                       TO_DATE( ei.iss_req_dttm , 'YYYYMMDDHH24MISS' ) AS req_dt ,
                       ei.iss_req_emp_id ,
                       ei.iss_req_dpt_id ,
                       ei.iss_req_dttm ,
                       ei.iss_dead_dttm ,
                       ei.iss_ent_id ,
                       ei.iss_tas_id ,
                       CASE
                           WHEN ei.iss_req_title = ''
                           THEN '제목없음'
                           WHEN ei.iss_cat_cd ='WORCAT03'
                           AND  ei.iss_tas_id IN ( 'TAS03292' , 'TAS03203' )
                           THEN (
                                 SELECT wor_force_num
                                 FROM   eso_workorder a
                                 WHERE  a.wor_id = ei.iss_sr_id
                                )
                           ELSE ei.iss_req_title
                       END AS req_title -- 제목
                       ,ei.iss_ass_emp_id
                --       ,get_empname( ei.iss_ass_emp_id ) AS ass_name --modified by exem
                       ,(select emp_name from ecf_employee where emp_id=ei.ISS_ASS_EMP_ID)  ass_name
                FROM   eso_issue ei ,
                       (
                        SELECT *
                        FROM   eso_cha
                        WHERE  cha_pl_emp_id IS NOT NULL
                       ) ec
                WHERE  ei.iss_sr_id IN (
                                        SELECT cha_csr_id
                                        FROM   eso_cha
                                        WHERE  cha_pl_emp_id IN (
                                                                 SELECT emp_id
                                                                 FROM   ecf_employee
                --                                                 WHERE  get_sysdate( ) BETWEEN emp_agcstart_dttm AND    emp_agcfinish_dttm -- modified by exem
                                                                 WHERE TO_CHAR(SYSDATE,'yyyymmddhh24miss')   BETWEEN emp_agcstart_dttm AND  emp_agcfinish_dttm
                                                                )
                       )
                AND    iss_tas_id IN ( 'TAS03165' , 'TCSR12010' )
				union
                --cond5
                SELECT DISTINCT ei.iss_sr_id AS id -- ID
                       ,
                       ei.iss_cat_cd ,
                       CASE
                           WHEN ei.iss_cat_cd IN ( 'COD03601' , 'COD03602' , 'COD03603' )
                           THEN '서비스요청관리'
                           ELSE (
                                 SELECT NVL( ent_label , ent_name )
                                 FROM   efc_entity a
                                 WHERE  a.ent_id = ei.iss_ent_id
                                )
                       END AS locale_ent_nm -- 엔티티명
                       ,
                       NVL( (
                             SELECT MAX( cod_name )
                             FROM   ecf_code a
                             WHERE  a.cod_used=1
                             AND    a.cod_id=ei.iss_cat_cd
                            ) , '' ) AS cat_name ,
                       ei.iss_req_dttm AS req_dttm -- 요청일
                       ,
                       TO_DATE( ei.iss_req_dttm , 'YYYYMMDDHH24MISS' ) AS req_dt ,
                       ei.iss_req_emp_id ,
                       ei.iss_req_dpt_id ,
                       ei.iss_req_dttm ,
                       ei.iss_dead_dttm ,
                       ei.iss_ent_id ,
                       ei.iss_tas_id ,
                       CASE
                           WHEN ei.iss_req_title = ''
                           THEN '제목없음'
                           WHEN ei.iss_cat_cd ='WORCAT03'
                           AND  ei.iss_tas_id IN ( 'TAS03292' , 'TAS03203' )
                           THEN (
                                 SELECT wor_force_num
                                 FROM   eso_workorder a
                                 WHERE  a.wor_id = ei.iss_sr_id
                                )
                           ELSE ei.iss_req_title
                       END AS req_title -- 제목
                       ,
                       CASE
                           WHEN ei.iss_ass_emp_id IS NULL
                           THEN ew.wor_ass_emp_id
                           ELSE ei.iss_ass_emp_id
                       END AS iss_ass_emp_id ,
                --       CASE
                --           WHEN ei.iss_ass_emp_id IS NULL THEN get_empname( ew.wor_ass_emp_id )
                --           ELSE get_empname( ei.iss_ass_emp_id )
                --       END AS ass_name -- modified by exem
                       CASE
                           WHEN ei.iss_ass_emp_id IS NULL THEN (select emp_name from ecf_employee where emp_id=ew.wor_ass_emp_id  )
                           ELSE (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id )
                       END AS ass_name
                FROM   eso_issue ei ,
                       eso_workorder ew
                WHERE  ei.iss_sr_id = ew.wor_src_id
                AND    ew.wor_cla_cd IN ( 'CHIWORMH' )
                AND    ei.iss_tas_id IN ( 'TCHA13010' )
				union
				--cond6
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then ew.WOR_ASS_EMP_ID
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.ISS_ASS_EMP_ID is null then get_empname(ew.WOR_ASS_EMP_ID)
--						else get_empname(ei.iss_ass_emp_id) end  AS ASS_NAME  --modified by exem
					, case when ei.ISS_ASS_EMP_ID is null then  (select emp_name from ecf_employee where emp_id=ew.wor_ass_emp_id  )
						else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id ) end  AS ASS_NAME  --modified by exem
				from ESO_ISSUE ei,
					 eso_workorder ew
					where ei.ISS_SR_ID =  ew.WOR_SRC_ID
					and WOR_CLA_CD = CASE WHEN (SELECT CHA_CAT_CD FROM ESO_CHA WHERE CHA_ID = ei.ISS_SR_ID) IN ('CHMCAT01','CHMCAT03','CHMCAT05','CHMCAT07')
										   THEN 'CHIWORMHREAL' ELSE 'CHIWORMH' END
					AND ei.ISS_TAS_ID IN ('TCHA14030')
				union
				--cond7
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then ee.EMP_ID
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.ISS_ASS_EMP_ID is null then get_empname(ee.EMP_ID)       -- modified by exem
--						else get_empname(ei.iss_ass_emp_id) end  AS ASS_NAME
					, case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ee.EMP_ID)       -- modified by exem
						else (select emp_name from ecf_employee where emp_id=ee.EMP_ID) end  AS ASS_NAME
				from ESO_ISSUE ei,
					ECF_EMPLOYEE ee
				where ei.ISS_ASS_EMP_ID = ee.EMP_ID
--					and GET_SYSDATE() BETWEEN ee.EMP_AGCSTART_DTTM AND ee.EMP_AGCFINISH_DTTM
                    and TO_CHAR(SYSDATE,'yyyymmddhh24miss')   BETWEEN ee.EMP_AGCSTART_DTTM AND ee.EMP_AGCFINISH_DTTM
					AND 3 != (SELECT TAS_TYPE FROM EWF_TASK WHERE TAS_ID = ei.ISS_TAS_ID)
				union
				--cond8
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then em.MEM_EMP_ID
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.ISS_ASS_EMP_ID is null then get_empname(em.MEM_EMP_ID)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME               -- modified by exem
					, case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=em.MEM_EMP_ID)
						else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ECF_MEMBER em
					where ei.ISS_ASS_WOG_ID = em.MEM_WOG_ID
					and em.MEM_EMP_ID IN (
                                          SELECT EMP_ID
                                          FROM ECF_EMPLOYEE
--                                          WHERE GET_SYSDATE() BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM --modified by exem
                                          WHERE TO_CHAR(SYSDATE,'yyyymmddhh24miss') BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM
                                          )
				union
				--cond9
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.ISS_ASS_EMP_ID is null then ew.WOR_ASS_EMP_ID
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.ISS_ASS_EMP_ID is null then get_empname(ew.WOR_ASS_EMP_ID)
--						else get_empname(ei.iss_ass_emp_id) end  AS ASS_NAME    --modified by exem
					, case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ew.WOR_ASS_EMP_ID)
						else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ESO_WORKORDER ew
					where ei.ISS_TAS_ID IN ('TCHA13010', 'TCHA14030')
					AND ei.ISS_SR_ID = ew.WOR_SRC_ID
					and ew.WOR_ASS_EMP_ID IN (
                                              SELECT EMP_ID
                                              FROM ECF_EMPLOYEE
--                                              WHERE GET_SYSDATE() BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM -- modified by exem
                                              WHERE TO_CHAR(SYSDATE,'yyyymmddhh24miss') BETWEEN EMP_AGCSTART_DTTM AND EMP_AGCFINISH_DTTM
                                              )
					AND ew.WOR_CLA_CD NOT IN ('CHIWORHD','CHIWORPEER','CHIWORSRC','CHIWORFORCE')
				UNION
				--cond10
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME --modified by exem
					, case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ewc.wfc_src_id)
					  else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					eso_icm icm,
					(select WFC_SRC_ID from ESO_WF_CODE where wfc_cod_id = 'ITSV2202-04110' and WFC_TYPE_CD ='JOBCAT') ewc
				where ei.ISS_ASS_EMP_ID IS NULL
					AND ei.ISS_TAS_ID = 'TAS03415'
					AND ei.ISS_SR_ID = icm.ICM_ID
					AND icm.ICM_EIM_ID IS NOT NULL
				UNION
				--cond11
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME  --modified by exem
					, case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ewc.wfc_src_id)
					  else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ESO_PBM pbm,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT') ewc
				where ei.ISS_ASS_EMP_ID IS NULL
				AND ei.ISS_TAS_ID = 'TPBM12010'
				AND ei.ISS_SR_ID = pbm.PBM_ID
				and pbm.PBM_TAS_ID ='TPBM12010'
				and ewc.wfc_cod_id = (SELECT COD_val FROM ECF_CODE WHERE COD_CTY_ID = 'ICMSOL' and cod_id = pbm.PBM_WORK_AREA_CD)
				UNION
				--cond12
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME   --modified by exem
					, case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ewc.wfc_src_id)
					  else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ESO_SRM srm,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2205-00010') ewc
				where ei.ISS_ASS_EMP_ID IS NULL
					AND ei.ISS_TAS_ID = 'TSRM23010'
					AND ei.ISS_SR_ID=srm.SRM_ID
					and SRM_PC_TF = 'ITSV2205-00010'
				UNION
				--cond13
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME      --modified by exem
					, case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ewc.wfc_src_id)
					  else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ESO_EVM ev,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-01230') ewc
				where ei.ISS_ASS_EMP_ID IS NULL
				AND ei.ISS_TAS_ID = 'TEVM11010'
				AND ei.ISS_SR_ID = ev.EVM_ID
				and DECODE(ev.EVM_EMP_DPT_ID ,'SM2_BSBK','981','SM1_BSBK','982','SM3_BSBK','983','SM4_BSBK','988',ev.EVM_EMP_DPT_ID ) in (SELECT EMP_DPT_ID FROM ECF_EMPLOYEE WHERE EMP_ID in ( select WFC_SRC_ID from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-01230'))
				AND EVM_EMP_ID IN (SELECT EMP_ID FROM ECF_EMPLOYEE WHERE EMP_AM_YN IS NULL OR EMP_AM_YN = '0')
				UNION
				--cond14
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewe.wfe_emp_id
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.iss_ass_emp_id is null then get_empname(ewe.wfe_emp_id)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME                  -- modified by exem
                    , case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ewe.wfe_emp_id)
					  else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					ESO_WF_EMPS ewe
				where ei.ISS_ASS_EMP_ID IS NULL
					AND ei.ISS_TAS_ID  IN ('TAS03464','TAS03473')
					AND ei.ISS_SR_ID = ewe.wfe_src_id
					and ewe.wfe_type_cd ='CHK_WORK'
				UNION
				--cond15
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME                 -- modified by exem
                    , case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ewc.wfc_src_id)
					  else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-04110') ewc
				where ei.ISS_ASS_EMP_ID IS NULL
				AND ISS_CAT_CD = 'OCM_LONGTERM100'
				union
				--cond16
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME  -- modified by exem
                    , case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ewc.wfc_src_id)
					  else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-03120') ewc
				where ei.ISS_ASS_EMP_ID IS NULL
				AND ISS_CAT_CD = 'OCM_LONGTERM110'
				UNION
				--cond17
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME                   -- modified by exem
                    , case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ewc.wfc_src_id)
					  else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-03130') ewc
				where ei.ISS_ASS_EMP_ID IS NULL
				AND ISS_CAT_CD = 'OCM_LONGTERM120'
				UNION
				--cond18
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME    -- modified by exem
                    , case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ewc.wfc_src_id)
					  else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-03240') ewc
				where ei.ISS_ASS_EMP_ID IS NULL
				AND ISS_CAT_CD = 'OCM_LONGTERM130'
				UNION
				--cond19
				select DISTINCT
					ei.ISS_SR_ID AS ID -- ID
					,ei.iss_cat_cd
					, case when ei.iss_cat_cd in ('COD03601','COD03602','COD03603') then '서비스요청관리'
						else (SELECT NVL(ENT_LABEL, ENT_NAME)
					    	FROM EFC_ENTITY A
					    	WHERE A.ENT_ID = ei.ISS_ENT_ID) end as LOCALE_ENT_NM -- 엔티티명
					, nvl((SELECT MAX(COD_NAME)
					        FROM ECF_CODE A
					        WHERE A.COD_USED=1
					          AND A.COD_ID=ei.ISS_CAT_CD),'') AS CAT_NAME
					, ei.ISS_REQ_DTTM as REQ_DTTM -- 요청일
					, TO_DATE(ei.iss_req_dttm,'YYYYMMDDHH24MISS') as req_dt
					, ei.iss_req_emp_id
					, ei.iss_req_dpt_id
					, ei.iss_req_dttm
					, ei.iss_dead_dttm
					, ei.iss_ent_id
					, ei.iss_tas_id
					, CASE WHEN ei.ISS_REQ_TITLE = '' THEN '제목없음'
							WHEN ei.ISS_CAT_CD ='WORCAT03' AND ei.ISS_TAS_ID IN ('TAS03292','TAS03203') THEN (SELECT WOR_FORCE_NUM
																										FROM ESO_WORKORDER A
					       																			WHERE A.WOR_ID = ei.ISS_SR_ID )
					ELSE ei.ISS_REQ_TITLE
					END AS REQ_TITLE -- 제목
					, case when ei.iss_ass_emp_id is null then ewc.wfc_src_id
						else ei.iss_ass_emp_id end as iss_ass_emp_id
--					, case when ei.iss_ass_emp_id is null then get_empname(ewc.wfc_src_id)
--						else get_empname(ei.iss_ass_emp_id) end AS ASS_NAME     -- modified by exem
                    , case when ei.ISS_ASS_EMP_ID is null then (select emp_name from ecf_employee where emp_id=ewc.wfc_src_id)
					  else (select emp_name from ecf_employee where emp_id=ei.iss_ass_emp_id) end AS ASS_NAME
				from ESO_ISSUE ei,
					(select WFC_SRC_ID, wfc_cod_id from ESO_WF_CODE where WFC_TYPE_CD ='JOBCAT' AND WFC_COD_ID = 'ITSV2202-03110') ewc
				where ei.ISS_ASS_EMP_ID IS NULL
				AND ISS_CAT_CD = 'OCM_LONGTERM140'
				)
			) T
	   , EWF_TASK E
	   , EWF_ACTIVITY A
	   , EWF_WORKFLOW W
	WHERE T.ISS_TAS_ID = E.TAS_ID
	  AND TAS_ENT_ID NOT IN ('UX120')
	  AND E.TAS_TYPE IN ('1','2','4') -- 타스크 유형(접수,처리)
	  AND E.TAS_ACT_ID = A.ACT_ID
	  AND A.ACT_WOF_ID = W.WOF_ID
) a
where(req_dt+(select ofm_men_num from eso_ofm where ofm_men_num != 0 and ofm_sys_id = ent_id and ofm_med_cd=tas_id )) < SYSDATE
	 and (
	 		((trunc(sysdate-(req_dt+(select ofm_men_num from eso_ofm where ofm_sys_id = ent_id and ofm_med_cd=tas_id)))) = 1)
		or
			((trunc(sysdate-(req_dt+(select ofm_men_num from eso_ofm where ofm_sys_id = ent_id and ofm_med_cd=tas_id)))) >= 2
			and mod(trunc(sysdate-(to_date(to_char(sysdate,'YYYY')||'0101000000','YYYYMMDDHH24MISS')))
				,to_number((select ofm_export_loc from eso_ofm where ofm_sys_id = ent_id and ofm_med_cd=tas_id))) = 0 )
	 	)
order by id
;

Plan hash value: 3832521299

----------------------------------------------------------------------------------------------------------------------------------------------------------
| Id  | Operation                                     | Name                | Starts | E-Rows | A-Rows |   A-Time   | Buffers |  OMem |  1Mem | Used-Mem |
----------------------------------------------------------------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                              |                     |      1 |        |      0 |00:00:04.11 |     262K|       |       |          |
|   1 |  SORT ORDER BY                                |                     |      1 |      1 |      0 |00:00:04.11 |     262K|  1024 |  1024 |          |
|*  2 |   FILTER                                      |                     |      1 |        |      0 |00:00:04.11 |     262K|       |       |          |
|*  3 |    HASH JOIN                                  |                     |      1 |  60607 |  21795 |00:00:04.04 |     258K|  1651K|  1651K| 1344K (0)|
|*  4 |     HASH JOIN                                 |                     |      1 |    605 |    594 |00:00:00.01 |      36 |  1335K|  1335K| 1490K (0)|
|*  5 |      TABLE ACCESS FULL                        | EWF_TASK            |      1 |    606 |    612 |00:00:00.01 |      16 |       |       |          |
|   6 |      NESTED LOOPS                             |                     |      1 |    601 |    613 |00:00:00.01 |      20 |       |       |          |
|   7 |       TABLE ACCESS FULL                       | EWF_ACTIVITY        |      1 |    602 |    637 |00:00:00.01 |      16 |       |       |          |
|*  8 |       INDEX UNIQUE SCAN                       | PK_EWF_WORKFLOW     |    637 |      1 |    613 |00:00:00.01 |       4 |       |       |          |
|   9 |     VIEW                                      |                     |      1 |    114K|    123K|00:00:03.95 |     258K|       |       |          |
|  10 |      SORT UNIQUE                              |                     |      1 |    114K|    123K|00:00:03.90 |     258K|    34M|  2548K|   30M (0)|
|  11 |       UNION-ALL                               |                     |      1 |        |    190K|00:00:03.36 |     258K|       |       |          |
|  12 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |    190 |      1 |    190 |00:00:00.01 |     198 |       |       |          |
|* 13 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |    190 |      1 |    190 |00:00:00.01 |       4 |       |       |          |
|  14 |        SORT AGGREGATE                         |                     |  14669 |      1 |  14669 |00:00:00.12 |   28230 |       |       |          |
|* 15 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |  14669 |      1 |  14665 |00:00:00.09 |   28230 |       |       |          |
|* 16 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |  14669 |      1 |  14667 |00:00:00.04 |   13563 |       |       |          |
|  17 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 18 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 19 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |  46821 |      1 |  46721 |00:00:00.19 |   47037 |       |       |          |
|* 20 |        TABLE ACCESS FULL                      | ESO_ISSUE           |      1 |    113K|    117K|00:00:00.24 |   15208 |       |       |          |
|  21 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      3 |      1 |      3 |00:00:00.01 |       5 |       |       |          |
|* 22 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      3 |      1 |      3 |00:00:00.01 |       2 |       |       |          |
|  23 |        SORT AGGREGATE                         |                     |     15 |      1 |     15 |00:00:00.01 |      34 |       |       |          |
|* 24 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |     15 |      1 |     15 |00:00:00.01 |      34 |       |       |          |
|* 25 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |     15 |      1 |     15 |00:00:00.01 |      19 |       |       |          |
|  26 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      7 |      1 |      7 |00:00:00.01 |      17 |       |       |          |
|* 27 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      7 |      1 |      7 |00:00:00.01 |       9 |       |       |          |
|* 28 |        FILTER                                 |                     |      1 |        |    136 |00:00:00.16 |   15353 |       |       |          |
|* 29 |         HASH JOIN                             |                     |      1 |   5892 |    209 |00:00:00.15 |   15318 |   830K|   830K| 1350K (0)|
|* 30 |          TABLE ACCESS FULL                    | ESO_ISSUE           |      1 |     67 |     71 |00:00:00.14 |   15208 |       |       |          |
|  31 |          INDEX FAST FULL SCAN                 | IX_ECF_MEMBER_01    |      1 |  11764 |  11766 |00:00:00.01 |     110 |       |       |          |
|* 32 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |     35 |      1 |     30 |00:00:00.01 |      35 |       |       |          |
|  33 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|* 34 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |       |       |          |
|  35 |        SORT AGGREGATE                         |                     |      1 |      1 |      1 |00:00:00.01 |       3 |       |       |          |
|* 36 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      1 |      1 |      1 |00:00:00.01 |       3 |       |       |          |
|* 37 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|  38 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 39 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  40 |        NESTED LOOPS                           |                     |      1 |     36 |     70 |00:00:00.15 |   15346 |       |       |          |
|  41 |         NESTED LOOPS                          |                     |      1 |    154 |     70 |00:00:00.15 |   15279 |       |       |          |
|* 42 |          TABLE ACCESS FULL                    | ESO_ISSUE           |      1 |     77 |     69 |00:00:00.15 |   15208 |       |       |          |
|* 43 |          INDEX RANGE SCAN                     | IX_ESO_CHA01        |     69 |      2 |     70 |00:00:00.01 |      71 |       |       |          |
|* 44 |         TABLE ACCESS BY INDEX ROWID           | ESO_CHA             |     70 |      1 |     70 |00:00:00.01 |      67 |       |       |          |
|  45 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|* 46 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |       |       |          |
|  47 |        SORT AGGREGATE                         |                     |      1 |      1 |      1 |00:00:00.01 |       3 |       |       |          |
|* 48 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      1 |      1 |      1 |00:00:00.01 |       3 |       |       |          |
|* 49 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|  50 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 51 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 52 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      1 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|  53 |        MERGE JOIN CARTESIAN                   |                     |      1 |     14 |  39492 |00:00:00.15 |   16557 |       |       |          |
|  54 |         NESTED LOOPS                          |                     |      1 |      1 |      3 |00:00:00.07 |    9053 |       |       |          |
|  55 |          NESTED LOOPS                         |                     |      1 |      1 |    502 |00:00:00.07 |    8558 |       |       |          |
|* 56 |           HASH JOIN                           |                     |      1 |      1 |    502 |00:00:00.06 |    7544 |  1995K|  1995K| 1380K (0)|
|* 57 |            INDEX FAST FULL SCAN               | IX_ECF_EMPLOYEE_07  |      1 |      1 |      9 |00:00:00.01 |      40 |       |       |          |
|* 58 |            TABLE ACCESS FULL                  | ESO_CHA             |      1 |   8718 |  13164 |00:00:00.05 |    7504 |       |       |          |
|* 59 |           INDEX RANGE SCAN                    | IX01_ESO_ISSUE      |    502 |      1 |    502 |00:00:00.01 |    1014 |       |       |          |
|* 60 |          TABLE ACCESS BY INDEX ROWID          | ESO_ISSUE           |    502 |      1 |      3 |00:00:00.01 |     495 |       |       |          |
|  61 |         BUFFER SORT                           |                     |      3 |  13152 |  39492 |00:00:00.06 |    7504 |   372K|   372K|  330K (0)|
|* 62 |          TABLE ACCESS FULL                    | ESO_CHA             |      1 |  13152 |  13164 |00:00:00.04 |    7504 |       |       |          |
|  63 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|* 64 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |       |       |          |
|  65 |        SORT AGGREGATE                         |                     |      5 |      1 |      5 |00:00:00.01 |      12 |       |       |          |
|* 66 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      5 |      1 |      5 |00:00:00.01 |      12 |       |       |          |
|* 67 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      5 |      1 |      5 |00:00:00.01 |       7 |       |       |          |
|  68 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 69 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 70 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |    113 |      1 |    113 |00:00:00.01 |     116 |       |       |          |
|* 71 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |     18 |      1 |     18 |00:00:00.01 |      20 |       |       |          |
|  72 |        NESTED LOOPS                           |                     |      1 |    313 |    274 |00:00:00.12 |   15960 |       |       |          |
|  73 |         NESTED LOOPS                          |                     |      1 |    496 |    554 |00:00:00.12 |   15471 |       |       |          |
|* 74 |          TABLE ACCESS FULL                    | ESO_ISSUE           |      1 |    248 |    259 |00:00:00.12 |   15208 |       |       |          |
|* 75 |          INDEX RANGE SCAN                     | IX_ESO_WORKORDER_03 |    259 |      2 |    554 |00:00:00.01 |     263 |       |       |          |
|* 76 |         TABLE ACCESS BY INDEX ROWID           | ESO_WORKORDER       |    554 |      1 |    274 |00:00:00.01 |     489 |       |       |          |
|  77 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|* 78 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |       |       |          |
|  79 |        SORT AGGREGATE                         |                     |      3 |      1 |      3 |00:00:00.01 |       8 |       |       |          |
|* 80 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      3 |      1 |      3 |00:00:00.01 |       8 |       |       |          |
|* 81 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      3 |      1 |      3 |00:00:00.01 |       5 |       |       |          |
|  82 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 83 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 84 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|* 85 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      8 |      1 |      8 |00:00:00.01 |      10 |       |       |          |
|* 86 |        FILTER                                 |                     |      1 |        |      9 |00:00:00.11 |   15259 |       |       |          |
|  87 |         NESTED LOOPS                          |                     |      1 |     16 |     20 |00:00:00.11 |   15236 |       |       |          |
|  88 |          NESTED LOOPS                         |                     |      1 |     16 |     20 |00:00:00.11 |   15219 |       |       |          |
|* 89 |           TABLE ACCESS FULL                   | ESO_ISSUE           |      1 |      8 |      9 |00:00:00.11 |   15208 |       |       |          |
|* 90 |           INDEX RANGE SCAN                    | IX_ESO_WORKORDER_03 |      9 |      2 |     20 |00:00:00.01 |      11 |       |       |          |
|  91 |          TABLE ACCESS BY INDEX ROWID          | ESO_WORKORDER       |     20 |      2 |     20 |00:00:00.01 |      17 |       |       |          |
|  92 |         TABLE ACCESS BY INDEX ROWID           | ESO_CHA             |      9 |      1 |      9 |00:00:00.01 |      23 |       |       |          |
|* 93 |          INDEX UNIQUE SCAN                    | PK_ESO_CHA          |      9 |      1 |      9 |00:00:00.01 |      11 |       |       |          |
|  94 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |     17 |      1 |     17 |00:00:00.01 |      22 |       |       |          |
|* 95 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |     17 |      1 |     17 |00:00:00.01 |       4 |       |       |          |
|  96 |        SORT AGGREGATE                         |                     |     73 |      1 |     73 |00:00:00.01 |     147 |       |       |          |
|* 97 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |     73 |      1 |     72 |00:00:00.01 |     147 |       |       |          |
|* 98 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |     73 |      1 |     72 |00:00:00.01 |      75 |       |       |          |
|  99 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*100 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*101 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*102 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      9 |      1 |      9 |00:00:00.01 |      11 |       |       |          |
|*103 |        FILTER                                 |                     |      1 |        |  24092 |00:00:00.28 |   15337 |       |       |          |
|*104 |         HASH JOIN                             |                     |      1 |      5 |  24097 |00:00:00.25 |   15248 |  1922K|  1922K| 1374K (0)|
|*105 |          INDEX FAST FULL SCAN                 | IX_ECF_EMPLOYEE_07  |      1 |      1 |      9 |00:00:00.01 |      40 |       |       |          |
|*106 |          TABLE ACCESS FULL                    | ESO_ISSUE           |      1 |    115K|    117K|00:00:00.17 |   15208 |       |       |          |
| 107 |         TABLE ACCESS BY INDEX ROWID           | EWF_TASK            |     43 |      1 |     43 |00:00:00.01 |      89 |       |       |          |
|*108 |          INDEX UNIQUE SCAN                    | PK_EWF_TASK         |     43 |      1 |     43 |00:00:00.01 |      46 |       |       |          |
| 109 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|*110 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |       |       |          |
| 111 |        SORT AGGREGATE                         |                     |      2 |      1 |      2 |00:00:00.01 |       6 |       |       |          |
|*112 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      2 |      1 |      2 |00:00:00.01 |       6 |       |       |          |
|*113 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      2 |      1 |      2 |00:00:00.01 |       4 |       |       |          |
| 114 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*115 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*116 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|*117 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*118 |        HASH JOIN                              |                     |      1 |      1 |      9 |00:00:00.14 |   15259 |  1399K|  1399K| 1196K (0)|
| 119 |         NESTED LOOPS                          |                     |      1 |      1 |     39 |00:00:00.01 |      51 |       |       |          |
|*120 |          INDEX FAST FULL SCAN                 | IX_ECF_EMPLOYEE_07  |      1 |      1 |      9 |00:00:00.01 |      40 |       |       |          |
|*121 |          INDEX RANGE SCAN                     | IX_ECF_MEMBER_01    |      9 |      3 |     39 |00:00:00.01 |      11 |       |       |          |
|*122 |         TABLE ACCESS FULL                     | ESO_ISSUE           |      1 |     68 |     71 |00:00:00.14 |   15208 |       |       |          |
| 123 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*124 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 125 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*126 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*127 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 128 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*129 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*130 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*131 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 132 |        NESTED LOOPS                           |                     |      1 |      1 |      0 |00:00:00.01 |    1676 |       |       |          |
| 133 |         NESTED LOOPS                          |                     |      1 |      2 |    245 |00:00:00.01 |    1474 |       |       |          |
| 134 |          NESTED LOOPS                         |                     |      1 |      2 |    517 |00:00:00.01 |     371 |       |       |          |
|*135 |           INDEX FAST FULL SCAN                | IX_ECF_EMPLOYEE_07  |      1 |      1 |      9 |00:00:00.01 |      40 |       |       |          |
|*136 |           TABLE ACCESS BY INDEX ROWID BATCHED | ESO_WORKORDER       |      9 |      8 |    517 |00:00:00.01 |     331 |       |       |          |
|*137 |            INDEX RANGE SCAN                   | IX_ESO_WORKORDER_01 |      9 |    239 |    546 |00:00:00.01 |      13 |       |       |          |
|*138 |          INDEX RANGE SCAN                     | IX01_ESO_ISSUE      |    517 |      1 |    245 |00:00:00.01 |    1103 |       |       |          |
|*139 |         TABLE ACCESS BY INDEX ROWID           | ESO_ISSUE           |    245 |      1 |      0 |00:00:00.01 |     202 |       |       |          |
| 140 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*141 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 142 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*143 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*144 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 145 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*146 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*147 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*148 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 149 |        MERGE JOIN CARTESIAN                   |                     |      1 |      1 |      0 |00:00:00.01 |     127 |       |       |          |
| 150 |         NESTED LOOPS                          |                     |      1 |      1 |      0 |00:00:00.01 |     127 |       |       |          |
| 151 |          NESTED LOOPS                         |                     |      1 |      1 |      0 |00:00:00.01 |     127 |       |       |          |
|*152 |           TABLE ACCESS FULL                   | ESO_ICM             |      1 |      1 |      0 |00:00:00.01 |     127 |       |       |          |
|*153 |           INDEX RANGE SCAN                    | IX01_ESO_ISSUE      |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*154 |          TABLE ACCESS BY INDEX ROWID          | ESO_ISSUE           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 155 |         BUFFER SORT                           |                     |      0 |      1 |      0 |00:00:00.01 |       0 | 73728 | 73728 |          |
|*156 |          INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 157 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*158 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 159 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*160 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*161 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 162 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*163 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*164 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*165 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 166 |        NESTED LOOPS                           |                     |      1 |      1 |      0 |00:00:00.01 |     318 |       |       |          |
| 167 |         NESTED LOOPS                          |                     |      1 |      1 |      0 |00:00:00.01 |     318 |       |       |          |
|*168 |          TABLE ACCESS FULL                    | ESO_PBM             |      1 |      1 |      0 |00:00:00.01 |     318 |       |       |          |
|*169 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*170 |           INDEX RANGE SCAN                    | IX01_ESO_ISSUE      |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*171 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*172 |          TABLE ACCESS BY INDEX ROWID          | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*173 |           INDEX UNIQUE SCAN                   | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 174 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*175 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 176 |        SORT AGGREGATE                         |                     |      1 |      1 |      1 |00:00:00.01 |       3 |       |       |          |
|*177 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      1 |      1 |      1 |00:00:00.01 |       3 |       |       |          |
|*178 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
| 179 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*180 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*181 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      3 |      1 |      3 |00:00:00.01 |       5 |       |       |          |
|*182 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 183 |        NESTED LOOPS                           |                     |      1 |      1 |     39 |00:00:00.12 |   15335 |       |       |          |
| 184 |         NESTED LOOPS                          |                     |      1 |      1 |     39 |00:00:00.12 |   15257 |       |       |          |
| 185 |          MERGE JOIN CARTESIAN                 |                     |      1 |      1 |     39 |00:00:00.12 |   15213 |       |       |          |
|*186 |           INDEX RANGE SCAN                    | IX01_ESO_WF_CODE    |      1 |      1 |      3 |00:00:00.01 |       5 |       |       |          |
| 187 |           BUFFER SORT                         |                     |      3 |      4 |     39 |00:00:00.12 |   15208 |  2048 |  2048 | 2048  (0)|
|*188 |            TABLE ACCESS FULL                  | ESO_ISSUE           |      1 |      4 |     13 |00:00:00.12 |   15208 |       |       |          |
|*189 |          INDEX UNIQUE SCAN                    | PK_ESO_SRM          |     39 |      1 |     39 |00:00:00.01 |      44 |       |       |          |
|*190 |         TABLE ACCESS BY INDEX ROWID           | ESO_SRM             |     39 |      1 |     39 |00:00:00.01 |      78 |       |       |          |
| 191 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      1 |      1 |      1 |00:00:00.01 |       2 |       |       |          |
|*192 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      1 |      1 |      1 |00:00:00.01 |       1 |       |       |          |
| 193 |        SORT AGGREGATE                         |                     |      2 |      1 |      2 |00:00:00.01 |       6 |       |       |          |
|*194 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      2 |      1 |      2 |00:00:00.01 |       6 |       |       |          |
|*195 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      2 |      1 |      2 |00:00:00.01 |       4 |       |       |          |
| 196 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*197 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*198 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |    571 |      1 |    571 |00:00:00.01 |      22 |       |       |          |
|*199 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 200 |        MERGE JOIN CARTESIAN                   |                     |      1 |      1 |   8355 |00:00:00.03 |    3708 |       |       |          |
| 201 |         NESTED LOOPS                          |                     |      1 |      1 |    557 |00:00:00.03 |    3703 |       |       |          |
| 202 |          NESTED LOOPS                         |                     |      1 |      1 |    563 |00:00:00.02 |    2972 |       |       |          |
| 203 |           NESTED LOOPS                        |                     |      1 |      1 |    563 |00:00:00.02 |    2409 |       |       |          |
|*204 |            HASH JOIN                          |                     |      1 |      1 |    652 |00:00:00.01 |     179 |  2402K|  2402K|  939K (0)|
|*205 |             HASH JOIN                         |                     |      1 |      1 |     15 |00:00:00.01 |      53 |  1856K|  1856K| 1058K (0)|
|*206 |              INDEX RANGE SCAN                 | IX01_ESO_WF_CODE    |      1 |      1 |     15 |00:00:00.01 |       5 |       |       |          |
| 207 |              INDEX FAST FULL SCAN             | IX_ECF_EMPLOYEE_08  |      1 |      1 |   7792 |00:00:00.01 |      48 |       |       |          |
| 208 |             TABLE ACCESS FULL                 | ESO_EVM             |      1 |    321 |    322 |00:00:00.01 |     126 |       |       |          |
|*209 |            TABLE ACCESS BY INDEX ROWID BATCHED| ESO_ISSUE           |    652 |      1 |    563 |00:00:00.01 |    2230 |       |       |          |
|*210 |             INDEX RANGE SCAN                  | IX01_ESO_ISSUE      |    652 |      1 |   1265 |00:00:00.01 |     977 |       |       |          |
|*211 |           INDEX UNIQUE SCAN                   | SYS_C0020079        |    563 |      1 |    563 |00:00:00.01 |     563 |       |       |          |
|*212 |          TABLE ACCESS BY INDEX ROWID          | ECF_EMPLOYEE        |    563 |      1 |    557 |00:00:00.01 |     731 |       |       |          |
| 213 |         BUFFER SORT                           |                     |    557 |      1 |   8355 |00:00:00.01 |       5 |  2048 |  2048 | 2048  (0)|
|*214 |          INDEX RANGE SCAN                     | IX01_ESO_WF_CODE    |      1 |      1 |     15 |00:00:00.01 |       5 |       |       |          |
| 215 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      2 |      1 |      2 |00:00:00.01 |       4 |       |       |          |
|*216 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      2 |      1 |      2 |00:00:00.01 |       2 |       |       |          |
| 217 |        SORT AGGREGATE                         |                     |      3 |      1 |      3 |00:00:00.01 |       8 |       |       |          |
|*218 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      3 |      1 |      3 |00:00:00.01 |       8 |       |       |          |
|*219 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      3 |      1 |      3 |00:00:00.01 |       5 |       |       |          |
| 220 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*221 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*222 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |    151 |      1 |    151 |00:00:00.01 |     154 |       |       |          |
|*223 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*224 |        HASH JOIN                              |                     |      1 |    509 |    963 |00:00:00.38 |   17733 |   897K|   897K| 1311K (0)|
|*225 |         TABLE ACCESS FULL                     | ESO_ISSUE           |      1 |    176 |    347 |00:00:00.14 |   15208 |       |       |          |
|*226 |         INDEX FAST FULL SCAN                  | IX01_ESO_WF_EMPS    |      1 |    215K|    232K|00:00:00.09 |    2525 |       |       |          |
| 227 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*228 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 229 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*230 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*231 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 232 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*233 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*234 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*235 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 236 |        MERGE JOIN CARTESIAN                   |                     |      1 |      4 |      0 |00:00:00.08 |    3733 |       |       |          |
|*237 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      1 |      1 |      3 |00:00:00.01 |       5 |       |       |          |
| 238 |         BUFFER SORT                           |                     |      3 |     18 |      0 |00:00:00.08 |    3728 |  1024 |  1024 |          |
|*239 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      1 |     18 |      0 |00:00:00.08 |    3728 |       |       |          |
|*240 |           INDEX SKIP SCAN                     | IX01_ESO_ISSUE      |      1 |     35 |     35 |00:00:00.08 |    3694 |       |       |          |
| 241 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*242 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 243 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*244 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*245 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 246 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*247 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*248 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*249 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 250 |        MERGE JOIN CARTESIAN                   |                     |      1 |      3 |      0 |00:00:00.06 |    3732 |       |       |          |
|*251 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      1 |      1 |      3 |00:00:00.01 |       5 |       |       |          |
| 252 |         BUFFER SORT                           |                     |      3 |     16 |      0 |00:00:00.06 |    3727 |  1024 |  1024 |          |
|*253 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      1 |     16 |      0 |00:00:00.06 |    3727 |       |       |          |
|*254 |           INDEX SKIP SCAN                     | IX01_ESO_ISSUE      |      1 |     31 |     33 |00:00:00.06 |    3694 |       |       |          |
| 255 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*256 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 257 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*258 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*259 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 260 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*261 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*262 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*263 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 264 |        MERGE JOIN CARTESIAN                   |                     |      1 |      3 |      0 |00:00:00.07 |    3732 |       |       |          |
|*265 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      1 |      1 |      3 |00:00:00.01 |       5 |       |       |          |
| 266 |         BUFFER SORT                           |                     |      3 |     16 |      0 |00:00:00.07 |    3727 |  1024 |  1024 |          |
|*267 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      1 |     16 |      0 |00:00:00.07 |    3727 |       |       |          |
|*268 |           INDEX SKIP SCAN                     | IX01_ESO_ISSUE      |      1 |     31 |     33 |00:00:00.07 |    3694 |       |       |          |
| 269 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*270 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 271 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*272 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*273 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 274 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*275 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*276 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*277 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 278 |        MERGE JOIN CARTESIAN                   |                     |      1 |      4 |      0 |00:00:00.06 |    3732 |       |       |          |
|*279 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      1 |      1 |     11 |00:00:00.01 |       5 |       |       |          |
| 280 |         BUFFER SORT                           |                     |     11 |     16 |      0 |00:00:00.06 |    3727 |  1024 |  1024 |          |
|*281 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      1 |     16 |      0 |00:00:00.06 |    3727 |       |       |          |
|*282 |           INDEX SKIP SCAN                     | IX01_ESO_ISSUE      |      1 |     31 |     33 |00:00:00.06 |    3694 |       |       |          |
| 283 |        TABLE ACCESS BY INDEX ROWID            | EFC_ENTITY          |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*284 |         INDEX UNIQUE SCAN                     | PK_EFC_ENTITY       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 285 |        SORT AGGREGATE                         |                     |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*286 |         TABLE ACCESS BY INDEX ROWID           | ECF_CODE            |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*287 |          INDEX UNIQUE SCAN                    | PK_COD_ID           |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 288 |        TABLE ACCESS BY INDEX ROWID            | ESO_WORKORDER       |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*289 |         INDEX UNIQUE SCAN                     | PK_ESO_WORKORDER    |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*290 |        INDEX RANGE SCAN                       | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
|*291 |         INDEX RANGE SCAN                      | IX_ECF_EMPLOYEE_09  |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
| 292 |        MERGE JOIN CARTESIAN                   |                     |      1 |      8 |      0 |00:00:00.06 |    3732 |       |       |          |
|*293 |         INDEX RANGE SCAN                      | IX01_ESO_WF_CODE    |      1 |      1 |     20 |00:00:00.01 |       5 |       |       |          |
| 294 |         BUFFER SORT                           |                     |     20 |     16 |      0 |00:00:00.06 |    3727 |  1024 |  1024 |          |
|*295 |          TABLE ACCESS BY INDEX ROWID BATCHED  | ESO_ISSUE           |      1 |     16 |      0 |00:00:00.06 |    3727 |       |       |          |
|*296 |           INDEX SKIP SCAN                     | IX01_ESO_ISSUE      |      1 |     31 |     33 |00:00:00.06 |    3694 |       |       |          |
|*297 |    TABLE ACCESS FULL                          | ESO_OFM             |     72 |      1 |      2 |00:00:00.02 |    3960 |       |       |          |
|*298 |    TABLE ACCESS FULL                          | ESO_OFM             |      2 |      1 |      2 |00:00:00.01 |     110 |       |       |          |
|*299 |    TABLE ACCESS FULL                          | ESO_OFM             |      2 |      1 |      2 |00:00:00.01 |     110 |       |       |          |
|*300 |    TABLE ACCESS FULL                          | ESO_OFM             |      0 |      1 |      0 |00:00:00.01 |       0 |       |       |          |
----------------------------------------------------------------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------

   2 - filter((DECODE("from$_subquery$_006"."ISS_DEAD_DTTM",NULL,TO_DATE("from$_subquery$_006"."ISS_REQ_DTTM",'YYYYMMDDHH24MISS'),TO_DATE(SUBSTR("
              from$_subquery$_006"."ISS_DEAD_DTTM",1,8),'YYYYMMDD'))+<SYSDATE@! AND (TRUNC(SYSDATE@!-(DECODE("from$_subquery$_006"."ISS_DEAD_DTTM",NULL,TO_DATE(
              "from$_subquery$_006"."ISS_REQ_DTTM",'YYYYMMDDHH24MISS'),TO_DATE(SUBSTR("from$_subquery$_006"."ISS_DEAD_DTTM",1,8),'YYYYMMDD'))+))=1 OR
              (MOD(TRUNC(SYSDATE@!-TO_DATE(TO_CHAR(SYSDATE@!,'YYYY')||'0101000000','YYYYMMDDHH24MISS')),TO_NUMBER())=0 AND
              TRUNC(SYSDATE@!-(DECODE("from$_subquery$_006"."ISS_DEAD_DTTM",NULL,TO_DATE("from$_subquery$_006"."ISS_REQ_DTTM",'YYYYMMDDHH24MISS'),TO_DATE(SUBSTR
              ("from$_subquery$_006"."ISS_DEAD_DTTM",1,8),'YYYYMMDD'))+))>=2))))
   3 - access("from$_subquery$_006"."ISS_TAS_ID"="E"."TAS_ID")
   4 - access("E"."TAS_ACT_ID"="A"."ACT_ID")
   5 - filter((INTERNAL_FUNCTION("E"."TAS_TYPE") AND "TAS_ENT_ID"<>'UX120'))
   8 - access("A"."ACT_WOF_ID"="W"."WOF_ID")
  13 - access("A"."ENT_ID"=:B1)
  15 - filter(TO_NUMBER("A"."COD_USED")=1)
  16 - access("A"."COD_ID"=:B1)
  18 - access("A"."WOR_ID"=:B1)
  19 - access("EMP_ID"=:B1)
  20 - filter(("EI"."ISS_ASS_EMP_ID" IS NOT NULL AND "EI"."ISS_TAS_ID"<>'TCHA13010' AND "EI"."ISS_TAS_ID"<>'TCSR13010' AND
              "EI"."ISS_TAS_ID"<>'TAS03165' AND "EI"."ISS_TAS_ID"<>'TCSR12010' AND "EI"."ISS_TAS_ID"<>'TCHA14030' AND "EI"."ISS_TAS_ID"<>'TAS03180' AND
              "EI"."ISS_TAS_ID"<>'TAS03197' AND "EI"."ISS_TAS_ID"<>'TAS03192' AND "EI"."ISS_TAS_ID"<>'TAS03223'))
  22 - access("A"."ENT_ID"=:B1)
  24 - filter(TO_NUMBER("A"."COD_USED")=1)
  25 - access("A"."COD_ID"=:B1)
  27 - access("A"."WOR_ID"=:B1)
  28 - filter( IS NOT NULL)
  29 - access("EI"."ISS_ASS_WOG_ID"="EM"."MEM_WOG_ID")
  30 - filter(("EI"."ISS_ASS_WOG_ID" IS NOT NULL AND "EI"."ISS_TAS_ID"<>'TSRM14010'))
  32 - access("EMP_ID"=:B1)
  34 - access("A"."ENT_ID"=:B1)
  36 - filter(TO_NUMBER("A"."COD_USED")=1)
  37 - access("A"."COD_ID"=:B1)
  39 - access("A"."WOR_ID"=:B1)
  42 - filter(("EI"."ISS_TAS_ID"='TAS03165' OR "EI"."ISS_TAS_ID"='TCSR12010'))
  43 - access("EI"."ISS_SR_ID"="ESO_CHA"."CHA_CSR_ID")
       filter("ESO_CHA"."CHA_CSR_ID" IS NOT NULL)
  44 - filter("CHA_PL_EMP_ID" IS NOT NULL)
  46 - access("A"."ENT_ID"=:B1)
  48 - filter(TO_NUMBER("A"."COD_USED")=1)
  49 - access("A"."COD_ID"=:B1)
  51 - access("A"."WOR_ID"=:B1)
  52 - access("EMP_ID"=:B1)
  56 - access("CHA_PL_EMP_ID"="EMP_ID")
  57 - filter(("EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss') AND "EMP_AGCSTART_DTTM"<=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss')))
  58 - filter(("CHA_PL_EMP_ID" IS NOT NULL AND "CHA_CSR_ID" IS NOT NULL))
  59 - access("EI"."ISS_SR_ID"="CHA_CSR_ID")
  60 - filter(("ISS_TAS_ID"='TAS03165' OR "ISS_TAS_ID"='TCSR12010'))
  62 - filter("CHA_PL_EMP_ID" IS NOT NULL)
  64 - access("A"."ENT_ID"=:B1)
  66 - filter(TO_NUMBER("A"."COD_USED")=1)
  67 - access("A"."COD_ID"=:B1)
  69 - access("A"."WOR_ID"=:B1)
  70 - access("EMP_ID"=:B1)
  71 - access("EMP_ID"=:B1)
  74 - filter("EI"."ISS_TAS_ID"='TCHA13010')
  75 - access("EI"."ISS_SR_ID"="EW"."WOR_SRC_ID")
  76 - filter("EW"."WOR_CLA_CD"='CHIWORMH')
  78 - access("A"."ENT_ID"=:B1)
  80 - filter(TO_NUMBER("A"."COD_USED")=1)
  81 - access("A"."COD_ID"=:B1)
  83 - access("A"."WOR_ID"=:B1)
  84 - access("EMP_ID"=:B1)
  85 - access("EMP_ID"=:B1)
  86 - filter("WOR_CLA_CD"=CASE  WHEN ((='CHMCAT01') OR (='CHMCAT03') OR (='CHMCAT05') OR (='CHMCAT07')) THEN 'CHIWORMHREAL' ELSE 'CHIWORMH' END )
  89 - filter("EI"."ISS_TAS_ID"='TCHA14030')
  90 - access("EI"."ISS_SR_ID"="EW"."WOR_SRC_ID")
  93 - access("CHA_ID"=:B1)
  95 - access("A"."ENT_ID"=:B1)
  97 - filter(TO_NUMBER("A"."COD_USED")=1)
  98 - access("A"."COD_ID"=:B1)
 100 - access("A"."WOR_ID"=:B1)
 101 - access("EMP_ID"=:B1)
 102 - access("EMP_ID"=:B1)
 103 - filter(TO_NUMBER()<>3)
 104 - access("EI"."ISS_ASS_EMP_ID"="EE"."EMP_ID")
 105 - filter(("EE"."EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss') AND
              "EE"."EMP_AGCSTART_DTTM"<=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss')))
 106 - filter("EI"."ISS_ASS_EMP_ID" IS NOT NULL)
 108 - access("TAS_ID"=:B1)
 110 - access("A"."ENT_ID"=:B1)
 112 - filter(TO_NUMBER("A"."COD_USED")=1)
 113 - access("A"."COD_ID"=:B1)
 115 - access("A"."WOR_ID"=:B1)
 116 - access("EMP_ID"=:B1)
 117 - access("EMP_ID"=:B1)
 118 - access("EI"."ISS_ASS_WOG_ID"="EM"."MEM_WOG_ID")
 120 - filter(("EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss') AND "EMP_AGCSTART_DTTM"<=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss')))
 121 - access("EM"."MEM_EMP_ID"="EMP_ID")
 122 - filter("EI"."ISS_ASS_WOG_ID" IS NOT NULL)
 124 - access("A"."ENT_ID"=:B1)
 126 - filter(TO_NUMBER("A"."COD_USED")=1)
 127 - access("A"."COD_ID"=:B1)
 129 - access("A"."WOR_ID"=:B1)
 130 - access("EMP_ID"=:B1)
 131 - access("EMP_ID"=:B1)
 135 - filter(("EMP_AGCFINISH_DTTM">=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss') AND "EMP_AGCSTART_DTTM"<=TO_CHAR(SYSDATE@!,'yyyymmddhh24miss')))
 136 - filter(("EW"."WOR_CLA_CD"<>'CHIWORHD' AND "EW"."WOR_CLA_CD"<>'CHIWORPEER' AND "EW"."WOR_CLA_CD"<>'CHIWORFORCE' AND
              "EW"."WOR_CLA_CD"<>'CHIWORSRC'))
 137 - access("EW"."WOR_ASS_EMP_ID"="EMP_ID")
 138 - access("EI"."ISS_SR_ID"="EW"."WOR_SRC_ID")
 139 - filter(("EI"."ISS_TAS_ID"='TCHA13010' OR "EI"."ISS_TAS_ID"='TCHA14030'))
 141 - access("A"."ENT_ID"=:B1)
 143 - filter(TO_NUMBER("A"."COD_USED")=1)
 144 - access("A"."COD_ID"=:B1)
 146 - access("A"."WOR_ID"=:B1)
 147 - access("EMP_ID"=:B1)
 148 - access("EMP_ID"=:B1)
 152 - filter("ICM"."ICM_EIM_ID" IS NOT NULL)
 153 - access("EI"."ISS_SR_ID"="ICM"."ICM_ID")
 154 - filter(("EI"."ISS_ASS_EMP_ID" IS NULL AND "EI"."ISS_TAS_ID"='TAS03415'))
 156 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-04110')
       filter("WFC_COD_ID"='ITSV2202-04110')
 158 - access("A"."ENT_ID"=:B1)
 160 - filter(TO_NUMBER("A"."COD_USED")=1)
 161 - access("A"."COD_ID"=:B1)
 163 - access("A"."WOR_ID"=:B1)
 164 - access("EMP_ID"=:B1)
 165 - access("EMP_ID"=:B1)
 168 - filter("PBM"."PBM_TAS_ID"='TPBM12010')
 169 - filter(("EI"."ISS_ASS_EMP_ID" IS NULL AND "EI"."ISS_TAS_ID"='TPBM12010'))
 170 - access("EI"."ISS_SR_ID"="PBM"."PBM_ID")
 171 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"=)
       filter("WFC_COD_ID"=)
 172 - filter("COD_CTY_ID"='ICMSOL')
 173 - access("COD_ID"=:B1)
 175 - access("A"."ENT_ID"=:B1)
 177 - filter(TO_NUMBER("A"."COD_USED")=1)
 178 - access("A"."COD_ID"=:B1)
 180 - access("A"."WOR_ID"=:B1)
 181 - access("EMP_ID"=:B1)
 182 - access("EMP_ID"=:B1)
 186 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2205-00010')
       filter("WFC_COD_ID"='ITSV2205-00010')
 188 - filter(("EI"."ISS_ASS_EMP_ID" IS NULL AND "EI"."ISS_TAS_ID"='TSRM23010'))
 189 - access("EI"."ISS_SR_ID"="SRM"."SRM_ID")
 190 - filter("SRM_PC_TF"='ITSV2205-00010')
 192 - access("A"."ENT_ID"=:B1)
 194 - filter(TO_NUMBER("A"."COD_USED")=1)
 195 - access("A"."COD_ID"=:B1)
 197 - access("A"."WOR_ID"=:B1)
 198 - access("EMP_ID"=:B1)
 199 - access("EMP_ID"=:B1)
 204 - access("EMP_DPT_ID"=DECODE("EV"."EVM_EMP_DPT_ID",'SM2_BSBK','981','SM1_BSBK','982','SM3_BSBK','983','SM4_BSBK','988',"EV"."EVM_EMP_DPT_ID")
              )
 205 - access("EMP_ID"="WFC_SRC_ID")
 206 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-01230')
       filter("WFC_COD_ID"='ITSV2202-01230')
 209 - filter(("EI"."ISS_ASS_EMP_ID" IS NULL AND "EI"."ISS_TAS_ID"='TEVM11010'))
 210 - access("EI"."ISS_SR_ID"="EV"."EVM_ID")
 211 - access("EVM_EMP_ID"="EMP_ID")
 212 - filter(("EMP_AM_YN" IS NULL OR "EMP_AM_YN"='0'))
 214 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-01230')
       filter("WFC_COD_ID"='ITSV2202-01230')
 216 - access("A"."ENT_ID"=:B1)
 218 - filter(TO_NUMBER("A"."COD_USED")=1)
 219 - access("A"."COD_ID"=:B1)
 221 - access("A"."WOR_ID"=:B1)
 222 - access("EMP_ID"=:B1)
 223 - access("EMP_ID"=:B1)
 224 - access("EI"."ISS_SR_ID"="EWE"."WFE_SRC_ID")
 225 - filter(("EI"."ISS_ASS_EMP_ID" IS NULL AND INTERNAL_FUNCTION("EI"."ISS_TAS_ID")))
 226 - filter("EWE"."WFE_TYPE_CD"='CHK_WORK')
 228 - access("A"."ENT_ID"=:B1)
 230 - filter(TO_NUMBER("A"."COD_USED")=1)
 231 - access("A"."COD_ID"=:B1)
 233 - access("A"."WOR_ID"=:B1)
 234 - access("EMP_ID"=:B1)
 235 - access("EMP_ID"=:B1)
 237 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-04110')
       filter("WFC_COD_ID"='ITSV2202-04110')
 239 - filter("EI"."ISS_ASS_EMP_ID" IS NULL)
 240 - access("ISS_CAT_CD"='OCM_LONGTERM100')
       filter("ISS_CAT_CD"='OCM_LONGTERM100')
 242 - access("A"."ENT_ID"=:B1)
 244 - filter(TO_NUMBER("A"."COD_USED")=1)
 245 - access("A"."COD_ID"=:B1)
 247 - access("A"."WOR_ID"=:B1)
 248 - access("EMP_ID"=:B1)
 249 - access("EMP_ID"=:B1)
 251 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-03120')
       filter("WFC_COD_ID"='ITSV2202-03120')
 253 - filter("EI"."ISS_ASS_EMP_ID" IS NULL)
 254 - access("ISS_CAT_CD"='OCM_LONGTERM110')
       filter("ISS_CAT_CD"='OCM_LONGTERM110')
 256 - access("A"."ENT_ID"=:B1)
 258 - filter(TO_NUMBER("A"."COD_USED")=1)
 259 - access("A"."COD_ID"=:B1)
 261 - access("A"."WOR_ID"=:B1)
 262 - access("EMP_ID"=:B1)
 263 - access("EMP_ID"=:B1)
 265 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-03130')
       filter("WFC_COD_ID"='ITSV2202-03130')
 267 - filter("EI"."ISS_ASS_EMP_ID" IS NULL)
 268 - access("ISS_CAT_CD"='OCM_LONGTERM120')
       filter("ISS_CAT_CD"='OCM_LONGTERM120')
 270 - access("A"."ENT_ID"=:B1)
 272 - filter(TO_NUMBER("A"."COD_USED")=1)
 273 - access("A"."COD_ID"=:B1)
 275 - access("A"."WOR_ID"=:B1)
 276 - access("EMP_ID"=:B1)
 277 - access("EMP_ID"=:B1)
 279 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-03240')
       filter("WFC_COD_ID"='ITSV2202-03240')
 281 - filter("EI"."ISS_ASS_EMP_ID" IS NULL)
 282 - access("ISS_CAT_CD"='OCM_LONGTERM130')
       filter("ISS_CAT_CD"='OCM_LONGTERM130')
 284 - access("A"."ENT_ID"=:B1)
 286 - filter(TO_NUMBER("A"."COD_USED")=1)
 287 - access("A"."COD_ID"=:B1)
 289 - access("A"."WOR_ID"=:B1)
 290 - access("EMP_ID"=:B1)
 291 - access("EMP_ID"=:B1)
 293 - access("WFC_TYPE_CD"='JOBCAT' AND "WFC_COD_ID"='ITSV2202-03110')
       filter("WFC_COD_ID"='ITSV2202-03110')
 295 - filter("EI"."ISS_ASS_EMP_ID" IS NULL)
 296 - access("ISS_CAT_CD"='OCM_LONGTERM140')
       filter("ISS_CAT_CD"='OCM_LONGTERM140')
 297 - filter(("OFM_MED_CD"=:B1 AND "OFM_MEN_NUM"<>0 AND "OFM_SYS_ID"=:B2))
 298 - filter(("OFM_MED_CD"=:B1 AND "OFM_SYS_ID"=:B2))
 299 - filter(("OFM_MED_CD"=:B1 AND "OFM_SYS_ID"=:B2))
 300 - filter(("OFM_MED_CD"=:B1 AND "OFM_SYS_ID"=:B2))
