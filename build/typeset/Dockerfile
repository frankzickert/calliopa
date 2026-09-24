# The typesetting service: Pandoc and TeX Live behind a small front that holds
# the bearer, so a document becomes a manuscript — LaTeX with its .bib and the
# PDF typeset from them. `docs/system/typesetting-service.md` carries the
# contract; this file is where the image side of it is enforced. This is the
# dogfood Dockerfile, already pinned by digest; the release script keeps the
# sources beside it in step. BO_0293_001 BO_0293_004
#
# The engine is the Debian distribution's own: Pandoc 2.17 and TeX Live 2022,
# on the cell recipe's base by digest, so a release's typesetting is pinned by
# that digest and this package list, and no tlmgr runs anywhere. Nothing is
# fetched at typesetting time: every class, style and font a manuscript uses
# is on the image.
FROM debian:bookworm-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      pandoc \
      latexmk \
      texlive-latex-base \
      texlive-latex-recommended \
      texlive-latex-extra \
      texlive-fonts-recommended \
      texlive-publishers \
      texlive-bibtex-extra \
      lmodern \
      python3 \
 && rm -rf /var/lib/apt/lists/*

# TeX reads and writes only inside the request's own directory: no absolute
# path, no parent directory, no dot file (kpathsea's paranoid setting, read
# from the environment), and no shell escape (passed on every run).
ENV openin_any=p \
    openout_any=p \
    CALLIOPA_TYPESET_PORT=8094 \
    CALLIOPA_TYPESET_VENUES=/opt/calliopa/typeset/venues

# The front reads its bearer as root, as every service of the stack does, and
# runs Pandoc and TeX as this user, who can read no secret even were the
# paranoid setting to fail.
RUN useradd --system --home /nonexistent --shell /usr/sbin/nologin typeset

WORKDIR /opt/calliopa/typeset
COPY front.py test_front.py entrypoint.sh ./
COPY venues ./venues
RUN chmod +x entrypoint.sh

EXPOSE 8094
ENTRYPOINT ["/opt/calliopa/typeset/entrypoint.sh"]
