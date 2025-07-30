module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("style");
  eleventyConfig.addPassthroughCopy("shared");
  eleventyConfig.addPassthroughCopy("script.js");

  eleventyConfig.addExtension("html", {
    key: "njk", 
    engine: "html",
  });

  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
    htmlTemplateEngine: "njk", 
    dataTemplateEngine: "njk" 
  };
};
