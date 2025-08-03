const { DateTime } = require("luxon");

module.exports = function(eleventyConfig) {
  eleventyConfig.addFilter("sitemapDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat('yyyy-LL-dd');
  });

  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("style");
  eleventyConfig.addPassthroughCopy("shared");
  eleventyConfig.addPassthroughCopy("ui.js");
  eleventyConfig.addPassthroughCopy("engine.js");
  eleventyConfig.addPassthroughCopy("robots.txt");

  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
    
    metadata: {
      url: "https://flaic.fun"
    },
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk"
  };
};